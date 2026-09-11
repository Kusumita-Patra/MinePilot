"use client";

import ComplianceRulesPanel from "@/components/governance/ComplianceRulesPanel";

export default function AdminCompliancePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Compliance Rules</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Document/certification requirements and their expiry warning thresholds. This is admin-managed
          master data — it is not yet consumed by the Documents/Contractors panels, which still run on
          their own frontend mock data (no real backend exists for that yet).
        </p>
      </div>
      <ComplianceRulesPanel canEdit />
    </div>
  );
}
