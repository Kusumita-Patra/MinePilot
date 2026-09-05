"use client";

import { useIncidents } from "@/hooks/useIncidents";
import IncidentsTable from "@/components/IncidentsTable";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function ViolationsPage() {
  const { incidents, loading, error, refresh } = useIncidents();
  const violations = incidents.filter((i) => i.severity === "WARNING" || i.severity === "CRITICAL");
  const bySector = violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.sector_id] = (acc[v.sector_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Violations</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Hazard breaches detected automatically from live sensor telemetry.
          </p>
        </div>
        <span className="text-xs text-neutral-500">{violations.length} total</span>
      </div>

      {error && <p className="text-xs text-amber-400">Can&apos;t reach the backend right now — showing last known violations.</p>}

      {Object.keys(bySector).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(bySector).map(([sector, count]) => (
            <span
              key={sector}
              className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-neutral-300"
            >
              {sector.replace(/_/g, " ")} · {count}
            </span>
          ))}
        </div>
      )}

      {loading && incidents.length === 0 ? (
        <LoadingOverlay active label="Loading violations..." />
      ) : (
        <IncidentsTable
          incidents={violations}
          onRefresh={refresh}
          emptyLabel="No active violations — all sectors within normal thresholds."
        />
      )}
    </div>
  );
}
