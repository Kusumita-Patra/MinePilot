"use client";

import AuditLogsPanel from "@/components/audit/AuditLogsPanel";

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Audit Logs</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Who did what, and when. Administrator-only.</p>
      </div>
      <AuditLogsPanel />
    </div>
  );
}
