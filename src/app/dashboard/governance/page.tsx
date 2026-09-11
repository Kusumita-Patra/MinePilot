"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import Tabs from "@/components/ui/Tabs";
import EmptyState from "@/components/ui/EmptyState";
import { ShieldOff } from "lucide-react";
import AlertRulesPanel from "@/components/governance/AlertRulesPanel";
import ComplianceRulesPanel from "@/components/governance/ComplianceRulesPanel";

export default function GovernancePage() {
  const { can, loading } = usePermissions();
  const [tab, setTab] = useState<"alerts" | "compliance">("alerts");

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (!can("governance.view")) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Not available"
        description="You don't have access to Alert Rules / Compliance Rules. An administrator can grant this from Roles & Permissions."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Governance</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {can("governance.edit")
            ? "You've been granted governance rule access by an administrator."
            : "Read-only — an administrator can grant edit access from Roles & Permissions."}
        </p>
      </div>

      <Tabs
        tabs={[
          { id: "alerts", label: "Alert Rules" },
          { id: "compliance", label: "Compliance Rules" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as "alerts" | "compliance")}
      />

      {tab === "alerts" ? (
        <AlertRulesPanel canEdit={can("governance.edit")} />
      ) : (
        <ComplianceRulesPanel canEdit={can("governance.edit")} />
      )}
    </div>
  );
}
