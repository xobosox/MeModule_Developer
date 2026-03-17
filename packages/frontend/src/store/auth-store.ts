import { create } from "zustand";
import type { User } from "../lib/types";
import { getToken, setToken, clearToken } from "../lib/auth";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  restore: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: (token: string, user: User) => {
    setToken(token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, isAuthenticated: false });
  },

  restore: () => {
    const token = getToken();
    if (token) {
      set({ token, isAuthenticated: true });
    }
  },
}));
