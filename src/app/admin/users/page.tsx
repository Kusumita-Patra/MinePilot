"use client";

import UserManagementPanel from "@/components/users/UserManagementPanel";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Users &amp; Access</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Manage every account&apos;s role and access. Administrator-only.
        </p>
      </div>
      <UserManagementPanel canManage />
    </div>
  );
}
