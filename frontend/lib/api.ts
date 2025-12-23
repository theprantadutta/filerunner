import axios, { AxiosInstance, AxiosError } from "axios";
import { getApiUrl } from "./config";

// Helper to get config object
export const getConfig = () => ({
  apiUrl: getApiUrl(),
});

// Types
export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
  must_change_password: boolean;
}

// New dual-token auth response
export interface TokenAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// Token refresh response
export interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Legacy auth response (for backward compatibility)
export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  api_key: string;
  is_public: boolean;
  created_at: string;
}

export interface ProjectResponse extends Project {
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
}

export interface Folder {
  id: string;
  project_id: string;
  path: string;
  is_public: boolean;
  created_at: string;
}

export interface FolderResponse extends Folder {
  file_count?: number;
  total_size?: number;
}

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

// Logout handler (set by the app)
let logoutHandler: (() => void) | null = null;

export const setLogoutHandler = (handler: () => void) => {
  logoutHandler = handler;
};

// Lazy-initialized axios instance
let _api: AxiosInstance | null = null;

const getApi = (): AxiosInstance => {
  if (!_api) {
    const apiUrl = getApiUrl();
    _api = axios.create({
      baseURL: apiUrl,
    });

    // Request interceptor - add auth token
    _api.interceptors.request.use((config) => {
      // Re-check API URL on each request in case config was updated
      config.baseURL = getApiUrl();

      if (typeof window !== "undefined") {
        const accessToken = localStorage.getItem("accessToken");
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      }
      return config;
    });

    // Response interceptor - handle 401 errors and token refresh
    _api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & {
          _retry?: boolean;
        };

        // If error is not 401 or request already retried, reject
        if (error.response?.status !== 401 || originalRequest?._retry) {
          return Promise.reject(error);
        }

        // Check if this is an auth endpoint (don't refresh for these)
        const isAuthEndpoint =
          originalRequest?.url?.includes("/auth/login") ||
          originalRequest?.url?.includes("/auth/register") ||
          originalRequest?.url?.includes("/auth/refresh");

        if (isAuthEndpoint) {
          return Promise.reject(error);
        }

        // Try to refresh the token
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          // No refresh token, logout
          if (logoutHandler) {
            logoutHandler();
          }
          return Promise.reject(error);
        }

        if (isRefreshing) {
          // Wait for refresh to complete
          return new Promise((resolve) => {
            subscribeTokenRefresh((token: string) => {
              if (originalRequest) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(axios(originalRequest));
              }
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const response = await axios.post<TokenRefreshResponse>(
            `${getApiUrl()}/auth/refresh`,
            { refresh_token: refreshToken }
          );

          const { access_token, refresh_token } = response.data;

          // Update stored tokens
          localStorage.setItem("accessToken", access_token);
          localStorage.setItem("refreshToken", refresh_token);

          // Notify subscribers
          onRefreshed(access_token);

          // Retry original request
          if (originalRequest) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return axios(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, logout
          if (logoutHandler) {
            logoutHandler();
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }

        return Promise.reject(error);
      }
    );
  }
  return _api;
};

// Export a proxy that lazily initializes the api
export const api = new Proxy({} as AxiosInstance, {
  get(_, prop) {
    const instance = getApi();
    const value = instance[prop as keyof AxiosInstance];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

// Auth API
export const authApi = {
  register: (email: string, password: string) =>
    api.post<TokenAuthResponse>("/auth/register", { email, password }),

  login: (email: string, password: string) =>
    api.post<TokenAuthResponse>("/auth/login", { email, password }),

  refresh: (refreshToken: string) =>
    api.post<TokenRefreshResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    }),

  me: () => api.get<User>("/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<{ message: string }>("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  logout: (refreshToken?: string) =>
    api.post<{ message: string }>("/auth/logout", {
      refresh_token: refreshToken,
    }),

  logoutAll: () => api.post<{ message: string; revoked_count: number }>("/auth/logout-all"),
};

// Projects API
export const projectsApi = {
  list: () => api.get<ProjectResponse[]>("/projects"),

  get: (id: string) => api.get<ProjectResponse>(`/projects/${id}`),

  create: (name: string, isPublic: boolean = false) =>
    api.post<Project>("/projects", { name, is_public: isPublic }),

  update: (id: string, name?: string, isPublic?: boolean) =>
    api.put<Project>(`/projects/${id}`, {
      name,
      is_public: isPublic,
    }),

  delete: (id: string) => api.delete(`/projects/${id}`),

  regenerateKey: (id: string) =>
    api.post<Project>(`/projects/${id}/regenerate-key`),

  listFiles: (id: string) => api.get<FileMetadata[]>(`/projects/${id}/files`),
};

// Files API
export const filesApi = {
  upload: (apiKey: string, file: File, folderPath?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folderPath) {
      formData.append("folder_path", folderPath);
    }

    return api.post("/upload", formData, {
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "multipart/form-data",
      },
    });
  },

  delete: (id: string) => api.delete(`/files/${id}`),

  getDownloadUrl: (id: string, apiKey?: string) => {
    const url = `${getApiUrl()}/files/${id}`;
    return apiKey ? `${url}?api_key=${apiKey}` : url;
  },
};

// Folders API
export const foldersApi = {
  list: (projectId: string) =>
    api.get<FolderResponse[]>("/folders", {
      params: { project_id: projectId },
    }),

  create: (projectId: string, path: string, isPublic?: boolean) =>
    api.post<Folder>("/folders", {
      project_id: projectId,
      path,
      is_public: isPublic,
    }),

  updateVisibility: (id: string, isPublic: boolean) =>
    api.put<Folder>(`/folders/${id}/visibility`, { is_public: isPublic }),
};
