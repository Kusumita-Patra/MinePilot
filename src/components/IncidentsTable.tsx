"use client";

import { useState } from "react";
import clsx from "clsx";
import { updateIncident } from "@/lib/api";
import { formatSectorId } from "@/lib/format";
import type { Incident } from "../../shared/types/telemetry";

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  WARNING: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  NORMAL: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  TRIGGERED: "text-red-400",
  ASSIGNED: "text-blue-400",
  RESOLVED: "text-emerald-400",
  ESCALATED: "text-amber-400",
  SIGNED_OFF: "text-neutral-500",
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function IncidentsTable({
  incidents,
  onRefresh,
  emptyLabel = "No incidents to show.",
}: {
  incidents: Incident[];
  onRefresh: () => void | Promise<void>;
  emptyLabel?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function signOff(ticketId: string) {
    setBusy(ticketId);
    try {
      await updateIncident(ticketId, { status: "SIGNED_OFF" });
      await onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  }

  if (incidents.length === 0) {
    return (
      <div className="bg-gray-900 border border-white/10 rounded-xl p-8 text-center">
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Sensor / Sector</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => {
              const canSignOff = inc.status === "RESOLVED" || inc.status === "ESCALATED";
              return (
                <tr key={inc.ticket_id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium">{inc.ticket_id}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    <div>{inc.sensor_id}</div>
                    <div className="text-[11px] text-neutral-600">{formatSectorId(inc.sector_id)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded-full text-[11px] border",
                        SEVERITY_STYLES[inc.severity] ?? SEVERITY_STYLES.NORMAL
                      )}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{inc.risk_score}</td>
                  <td className={clsx("px-4 py-3 text-xs font-medium", STATUS_STYLES[inc.status])}>
                    {inc.status}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-[11px]">{formatTime(inc.created_at)}</td>
                  <td className="px-4 py-3">
                    {canSignOff ? (
                      <button
                        disabled={busy === inc.ticket_id}
                        onClick={() => signOff(inc.ticket_id)}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-md px-3 py-1.5 text-[11px] font-medium"
                      >
                        Sign Off
                      </button>
                    ) : (
                      <span className="text-neutral-600 text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
