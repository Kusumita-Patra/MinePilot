"use client";

import AlertRulesPanel from "@/components/governance/AlertRulesPanel";

export default function AdminAlertsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Alert Rules</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Warning/critical thresholds by alert category. Real, admin-editable, and persisted.
        </p>
      </div>
      <AlertRulesPanel canEdit />
    </div>
  );
}
