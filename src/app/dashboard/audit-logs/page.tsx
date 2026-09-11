"use client";

import { usePermissions } from "@/hooks/usePermissions";
import EmptyState from "@/components/ui/EmptyState";
import { ShieldOff } from "lucide-react";
import AuditLogsPanel from "@/components/audit/AuditLogsPanel";

export default function DashboardAuditLogsPage() {
  const { can, loading } = usePermissions();

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (!can("audit_logs.view")) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Not available"
        description="You don't have access to Audit Logs. An administrator can grant this from Roles & Permissions."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Audit Logs</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Who did what, and when. You&apos;ve been granted this by an administrator.
        </p>
      </div>
      <AuditLogsPanel />
    </div>
  );
}
