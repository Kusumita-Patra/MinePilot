import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "field_worker" | "mine_manager";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "minepilot-auth",
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    }
  )
);
