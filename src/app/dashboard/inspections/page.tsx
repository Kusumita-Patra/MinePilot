"use client";

import { useState } from "react";
import clsx from "clsx";
import { useInspections } from "@/hooks/useInspections";
import { usePermissions } from "@/hooks/usePermissions";
import { createInspection, updateInspection, type InspectionStatus } from "@/lib/api";
import LoadingOverlay from "@/components/LoadingOverlay";
import { formatSectorId } from "@/lib/format";

const STATUS_FLOW: Record<InspectionStatus, InspectionStatus | null> = {
  SCHEDULED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: null,
};

const STATUS_LABEL: Record<InspectionStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

const STATUS_STYLES: Record<InspectionStatus, string> = {
  SCHEDULED: "text-amber-400 bg-amber-500/10",
  IN_PROGRESS: "text-blue-400 bg-blue-500/10",
  COMPLETED: "text-emerald-400 bg-emerald-500/10",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InspectionsPage() {
  const { inspections, loading, error, refresh } = useInspections();
  const { can } = usePermissions();
  const canSchedule = can("inspections.schedule");
  const [sectorId, setSectorId] = useState("");
  const [scheduledDate, setScheduledDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!sectorId.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createInspection({ sector_id: sectorId.trim(), scheduled_date: scheduledDate, notes: notes || undefined });
      setSectorId("");
      setNotes("");
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to schedule inspection");
    } finally {
      setSubmitting(false);
    }
  }

  async function advance(id: string, next: InspectionStatus) {
    setBusyId(id);
    try {
      await updateInspection(id, {
        status: next,
        completed_at: next === "COMPLETED" ? new Date().toISOString() : undefined,
      });
      await refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inspections</h1>
        <span className="text-xs text-neutral-500">{inspections.length} total</span>
      </div>

      {canSchedule && (
      <form
        onSubmit={handleSchedule}
        className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[180px]">
          <label className="text-[11px] text-neutral-400 block mb-1">Sector</label>
          <input
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            placeholder="sector_north_wall"
            required
            className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-neutral-400 block mb-1">Scheduled date</label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
            className="rounded-md bg-black/30 border border-white/10 p-2 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="text-[11px] text-neutral-400 block mb-1">Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Routine check…"
            className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
        >
          {submitting ? "Scheduling…" : "Schedule Inspection"}
        </button>
        {formError && <p className="text-xs text-red-400 w-full">{formError}</p>}
      </form>
      )}

      {error && <p className="text-xs text-amber-400">Can&apos;t reach the backend right now — showing last known inspections.</p>}

      {loading && inspections.length === 0 ? (
        <LoadingOverlay active label="Loading inspections..." />
      ) : inspections.length === 0 ? (
        <div className="bg-gray-900 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-sm text-neutral-500">No inspections scheduled yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((insp) => {
                  const next = STATUS_FLOW[insp.status];
                  return (
                    <tr key={insp.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                      <td className="px-4 py-3">{formatSectorId(insp.sector_id)}</td>
                      <td className="px-4 py-3 text-neutral-400">{insp.scheduled_date}</td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-[11px]", STATUS_STYLES[insp.status])}>
                          {STATUS_LABEL[insp.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-[11px] max-w-[200px] truncate">
                        {insp.notes || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {next ? (
                          <button
                            disabled={busyId === insp.id}
                            onClick={() => advance(insp.id, next)}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-md px-3 py-1.5 text-[11px] font-medium"
                          >
                            Mark {STATUS_LABEL[next]}
                          </button>
                        ) : (
                          <span className="text-neutral-600 text-[11px]">Done</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
