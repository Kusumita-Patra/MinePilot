import { create } from "zustand";
import { getMyPermissions } from "./api";

interface PermissionsState {
  permissions: Record<string, boolean> | null;
  loadedFor: string | null;
  loading: boolean;
  fetch: (userId: string) => Promise<void>;
  clear: () => void;
}

/** Shared across the app so Sidebar/pages don't each fetch independently.
 * Keyed by `loadedFor` (the user id it was fetched for) so switching accounts
 * in the same tab (logout -> different login, no full page reload) doesn't
 * leak the previous user's permissions — see usePermissions.ts. */
export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissions: null,
  loadedFor: null,
  loading: false,
  fetch: async (userId: string) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const permissions = await getMyPermissions();
      set({ permissions, loadedFor: userId, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  clear: () => set({ permissions: null, loadedFor: null, loading: false }),
}));
