import axios, { AxiosInstance, AxiosError, type AxiosProgressEvent } from "axios";
import { getApiUrl, getBaseUrl } from "./config";

// Helper to get config object
export const getConfig = () => ({
  apiUrl: getApiUrl(),
  baseUrl: getBaseUrl(), // For file URLs that already include /api
});

// ---------------------------------------------------------------- types

export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
  must_change_password: boolean;
}

export interface TokenAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  /** Full access: upload, download, delete */
  api_key: string;
  /** Download only: safe for links and front-end code */
  read_key: string;
  is_public: boolean;
  created_at: string;
}

export interface ProjectResponse extends Omit<Project, "user_id"> {
  file_count?: number;
  total_size?: number;
}

export interface FileMetadata {
  id: string;
  project_id: string;
  folder_id?: string;
  folder_path?: string;
  original_name: string;
  size: number;
  mime_type: string;
  upload_date: string;
  download_url: string;
  /** Signed, expiring link for files in private projects; opens this one file only */
  access_url?: string;
}

export interface RecentFile {
  id: string;
  project_id: string;
  project_name: string;
  project_is_public: boolean;
  folder_path?: string;
  original_name: string;
  size: number;
  mime_type: string;
  upload_date: string;
  download_url: string;
  access_url?: string;
}

export interface Stats {
  total_projects: number;
  total_files: number;
  total_size: number;
  by_category: { category: string; files: number; size: number }[];
  daily_uploads: { day: string; files: number; size: number }[];
}

export interface UploadResponse {
  file_id: string;
  original_name: string;
  size: number;
  mime_type: string;
  download_url: string;
  folder_path?: string;
}

// ---------------------------------------------------------------- token refresh

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

let logoutHandler: (() => void) | null = null;

export const setLogoutHandler = (handler: () => void) => {
  logoutHandler = handler;
};

/**
 * Get a fresh access token. Tabs share one session, so the refresh runs under a
 * cross-tab lock: if another tab rotated the refresh token while this one waited,
 * reuse its result instead of spending the old token (which the server would treat
 * as reuse and revoke the whole session).
 */
async function refreshAccessToken(): Promise<string> {
  const run = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("Not signed in");
    const response = await axios.post<TokenRefreshResponse>(`${getApiUrl()}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    localStorage.setItem("accessToken", response.data.access_token);
    localStorage.setItem("refreshToken", response.data.refresh_token);
    return response.data.access_token;
  };

  const tokenBeforeWait = localStorage.getItem("refreshToken");
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("filerunner-token-refresh", async () => {
      const current = localStorage.getItem("refreshToken");
      if (current && current !== tokenBeforeWait) {
        // Another tab refreshed while we waited
        return localStorage.getItem("accessToken") as string;
      }
      return run();
    });
  }
  return run();
}

let _api: AxiosInstance | null = null;

const getApi = (): AxiosInstance => {
  if (!_api) {
    _api = axios.create({ baseURL: getApiUrl() });

    _api.interceptors.request.use((config) => {
      config.baseURL = getApiUrl();
      if (typeof window !== "undefined") {
        const accessToken = localStorage.getItem("accessToken");
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      }
      return config;
    });

    _api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & { _retry?: boolean };

        if (error.response?.status !== 401 || originalRequest?._retry) {
          return Promise.reject(error);
        }

        const url = originalRequest?.url ?? "";
        if (url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh")) {
          return Promise.reject(error);
        }

        if (!localStorage.getItem("refreshToken")) {
          logoutHandler?.();
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            refreshSubscribers.push((token) => {
              if (!token || !originalRequest) return reject(error);
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(axios(originalRequest));
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;
        try {
          const accessToken = await refreshAccessToken();
          onRefreshed(accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axios(originalRequest);
        } catch (refreshError) {
          onRefreshed(null);
          logoutHandler?.();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    );
  }
  return _api;
};

export const api = new Proxy({} as AxiosInstance, {
  get(_, prop) {
    const instance = getApi();
    const value = instance[prop as keyof AxiosInstance];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// ---------------------------------------------------------------- endpoints

export const authApi = {
  register: (email: string, password: string) =>
    api.post<TokenAuthResponse>("/auth/register", { email, password }),

  login: (email: string, password: string) =>
    api.post<TokenAuthResponse>("/auth/login", { email, password }),

  me: () => api.get<User>("/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<{ message: string } & TokenRefreshResponse>("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  logout: (refreshToken?: string) =>
    api.post<{ message: string }>("/auth/logout", { refresh_token: refreshToken }),

  logoutAll: () => api.post<{ message: string; revoked_count: number }>("/auth/logout-all"),

  /** Deletes the account with all its projects and files */
  deleteAccount: (password: string) => api.delete<{ message: string }>("/auth/account", { data: { password } }),
};

export const projectsApi = {
  list: () => api.get<ProjectResponse[]>("/projects"),

  get: (id: string) => api.get<ProjectResponse>(`/projects/${id}`),

  create: (name: string, isPublic: boolean = false) =>
    api.post<Project>("/projects", { name, is_public: isPublic }),

  update: (id: string, changes: { name?: string; is_public?: boolean }) =>
    api.put<Project>(`/projects/${id}`, changes),

  delete: (id: string) => api.delete(`/projects/${id}`),

  regenerateKey: (id: string) => api.post<Project>(`/projects/${id}/regenerate-key`),

  regenerateReadKey: (id: string) => api.post<Project>(`/projects/${id}/regenerate-read-key`),

  listFiles: (id: string) => api.get<FileMetadata[]>(`/projects/${id}/files`),

  /** Deletes a folder, its subfolders, and every file in them */
  deleteFolder: (id: string, path: string) =>
    api.delete<{ message: string; deleted_count: number }>(`/projects/${id}/folders`, { params: { path } }),

  emptyProject: (id: string) =>
    api.delete<{ message: string; deleted_count: number }>(`/projects/${id}/empty`),
};

export const filesApi = {
  upload: (
    apiKey: string,
    file: File,
    options: {
      folderPath?: string;
      onProgress?: (event: AxiosProgressEvent) => void;
      signal?: AbortSignal;
    } = {}
  ) => {
    const formData = new FormData();
    // Fields before the file so the server knows the folder when the file arrives
    if (options.folderPath) formData.append("folder_path", options.folderPath);
    formData.append("file", file);
    return api.post<UploadResponse>("/upload", formData, {
      headers: { "X-API-Key": apiKey },
      onUploadProgress: options.onProgress,
      signal: options.signal,
    });
  },

  recent: (limit = 12) => api.get<RecentFile[]>("/files/recent", { params: { limit } }),

  delete: (id: string) => api.delete(`/files/${id}`),

  bulkDelete: (fileIds: string[]) =>
    api.delete<{ message: string; deleted_count: number }>("/files/bulk", {
      data: { file_ids: fileIds },
    }),
};

export const statsApi = {
  get: () => api.get<Stats>("/stats"),
};

/**
 * Browser URL for a file. Private files use their signed link so the project key
 * never appears in URLs. `download` asks for an attachment instead of inline display.
 */
export function fileUrl(
  file: Pick<FileMetadata, "download_url" | "access_url">,
  download = false
): string {
  const { baseUrl } = getConfig();
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(`${baseUrl}${file.access_url ?? file.download_url}`, origin);
  if (download) url.searchParams.set("download", "true");
  return url.toString();
}

/** Permanent public address of a file (works as-is for public projects) */
export function publicFileUrl(file: Pick<FileMetadata, "download_url">): string {
  const { baseUrl } = getConfig();
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  return new URL(`${baseUrl}${file.download_url}`, origin).toString();
}

/** Permanent link for a private file using the project's read-only key */
export function readKeyFileUrl(file: Pick<FileMetadata, "download_url">, readKey: string): string {
  const url = new URL(publicFileUrl(file));
  url.searchParams.set("api_key", readKey);
  return url.toString();
}
