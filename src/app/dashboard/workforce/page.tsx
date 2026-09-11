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
          {!loading && can("users.manage") && (
            <p className="text-xs text-amber-400 mt-0.5">
              You&apos;ve been granted user management access by an administrator.
            </p>
          )}
        </div>
      </div>

      {!loading && <UserManagementPanel canManage={can("users.manage")} />}
    </div>
  );
}
