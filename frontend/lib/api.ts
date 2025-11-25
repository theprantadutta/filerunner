import axios from "axios";
import { getApiUrl } from "./config";

// API URL is resolved at runtime - see config.ts for resolution logic
const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
  must_change_password: boolean;
}

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

// Auth API
export const authApi = {
  register: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { email, password }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }),

  me: () => api.get<User>("/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<{ message: string }>("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
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
    const url = `${API_URL}/files/${id}`;
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
