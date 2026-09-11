"use client";

import { usePermissions } from "@/hooks/usePermissions";
import EmptyState from "@/components/ui/EmptyState";
import { ShieldOff } from "lucide-react";
import SystemHealthPanel from "@/components/health/SystemHealthPanel";

export default function DashboardSystemHealthPage() {
  const { can, loading } = usePermissions();

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (!can("system_health.view")) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Not available"
        description="You don't have access to System Health. An administrator can grant this from Roles & Permissions."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">System Health</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Live checks against the services this backend actually depends on. You&apos;ve been granted this by
          an administrator.
        </p>
      </div>
      <SystemHealthPanel />
    </div>
  );
}
