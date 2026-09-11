"use client";

import { usePermissions } from "@/hooks/usePermissions";
import UserManagementPanel from "@/components/users/UserManagementPanel";

export default function WorkforcePage() {
  const { can, loading } = usePermissions();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Workforce</h1>
          {!loading && !can("users.manage") && (
            <p className="text-xs text-neutral-500 mt-0.5">
              Read-only view. Contact an administrator for user management access.
            </p>
          )}
        </div>
      </div>

      {!loading && <UserManagementPanel canManage={can("users.manage")} />}
    </div>
  );
}
