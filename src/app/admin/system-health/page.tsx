"use client";

import SystemHealthPanel from "@/components/health/SystemHealthPanel";

export default function AdminSystemHealthPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">System Health</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Live checks against the services this backend actually depends on — not hardcoded.
        </p>
      </div>
      <SystemHealthPanel />
    </div>
  );
}
