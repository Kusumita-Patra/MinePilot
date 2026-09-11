"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { usePermissionsStore } from "@/lib/permissionsStore";

/** What the signed-in user can actually do (administrator = everything;
 * mine_manager/field_worker = whatever an administrator has granted them via
 * /admin/roles). Use `can(capability)` to decide what UI to show — the
 * backend's require_permission(...) checks are still the real boundary, this
 * just keeps the UI from showing controls that would 403. */
export function usePermissions() {
  const userId = useAuthStore((s) => s.user?.id);
  const permissions = usePermissionsStore((s) => s.permissions);
  const loadedFor = usePermissionsStore((s) => s.loadedFor);
  const fetchPermissions = usePermissionsStore((s) => s.fetch);

  useEffect(() => {
    if (!userId || loadedFor === userId) return;
    const timer = setTimeout(() => fetchPermissions(userId), 0);
    return () => clearTimeout(timer);
  }, [userId, loadedFor, fetchPermissions]);

  const loading = !!userId && loadedFor !== userId;
  const can = (capability: string) => permissions?.[capability] ?? false;

  return { can, permissions, loading };
}
