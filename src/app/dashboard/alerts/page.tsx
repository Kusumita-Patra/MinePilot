"use client";

import { useState } from "react";
import clsx from "clsx";
import { useIncidents } from "@/hooks/useIncidents";
import IncidentsTable from "@/components/IncidentsTable";
import type { IncidentStatus } from "../../../../shared/types/telemetry";
import LoadingOverlay from "@/components/LoadingOverlay";

const TABS: { label: string; value: IncidentStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Triggered", value: "TRIGGERED" },
  { label: "Assigned", value: "ASSIGNED" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Escalated", value: "ESCALATED" },
  { label: "Signed Off", value: "SIGNED_OFF" },
];

export default function AlertsPage() {
  const { incidents, loading, error, refresh } = useIncidents();
  const [tab, setTab] = useState<IncidentStatus | "ALL">("ALL");

  const filtered = tab === "ALL" ? incidents : incidents.filter((i) => i.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Alerts</h1>
        <span className="text-xs text-neutral-500">{incidents.length} total</span>
      </div>

      {error && <p className="text-xs text-amber-400">Can&apos;t reach the backend right now — showing last known alerts.</p>}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              tab === t.value
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && incidents.length === 0 ? (
        <LoadingOverlay active label="Loading alerts..." />
      ) : (
        <IncidentsTable incidents={filtered} onRefresh={refresh} emptyLabel="No alerts in this status." />
      )}
    </div>
  );
}
