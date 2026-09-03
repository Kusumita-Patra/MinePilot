import { create } from "zustand";

export type UserRole = "field_worker" | "mine_manager";

interface RoleState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
}

export const useRoleStore = create<RoleState>((set, get) => ({
  role: "mine_manager",
  setRole: (role) => set({ role }),
  toggleRole: () =>
    set({ role: get().role === "mine_manager" ? "field_worker" : "mine_manager" }),
}));