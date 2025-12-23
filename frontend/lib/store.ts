import { create } from "zustand";
import { User } from "./api";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  updateUser: (user: User) => void;
  clearMustChangePassword: () => void;
  logout: () => void;
  // Check if user has any auth (for dashboard access check)
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken:
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
  refreshToken:
    typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null,
  user:
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "null")
      : null,

  setAuth: (accessToken, refreshToken, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({ accessToken, refreshToken, user });
  },

  updateUser: (user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({ user });
  },

  clearMustChangePassword: () => {
    set((state) => {
      if (state.user) {
        const updatedUser = { ...state.user, must_change_password: false };
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }
        return { user: updatedUser };
      }
      return state;
    });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      // Also remove legacy token if exists
      localStorage.removeItem("token");
    }
    set({ accessToken: null, refreshToken: null, user: null });
  },

  isAuthenticated: () => {
    const state = get();
    return !!(state.accessToken || state.refreshToken);
  },
}));
