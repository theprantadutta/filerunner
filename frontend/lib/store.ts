import { create } from "zustand";
import { User } from "./api";

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  clearMustChangePassword: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
  user: typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("user") || "null")
    : null,
  setAuth: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({ token, user });
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
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    set({ token: null, user: null });
  },
}));
