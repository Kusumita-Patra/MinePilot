"use client";

import { useState } from "react";
import Link from "next/link";
import { useIncidents } from "@/hooks/useIncidents";
import { updateIncident } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import LoadingOverlay from "@/components/LoadingOverlay";
import RequireAuth from "@/components/RequireAuth";
import type { Incident } from "../../../shared/types/telemetry";

function FieldWorkerView() {
  const { incidents, error, loading, refresh } = useIncidents();
  const workerId = useAuthStore((s) => s.user?.id);
  const [remarksByTicket, setRemarksByTicket] = useState<Record<string, string>>({});
  const [busyTicket, setBusyTicket] = useState<string | null>(null);

  // Field staff only care about tickets that aren't closed out yet.
  const active = incidents.filter((i) => i.status !== "SIGNED_OFF");

  async function act(ticket: Incident, patch: Parameters<typeof updateIncident>[1]) {
    setBusyTicket(ticket.ticket_id);
    try {
      await updateIncident(ticket.ticket_id, patch);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyTicket(null);
    }
  }

  return (

    <main className="min-h-screen bg-slate-950 text-white p-4 max-w-md mx-auto">
      <LoadingOverlay active={loading} label="Loading assigned alerts..." />

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">My Assigned Alerts</h1>
        <Link href="/dashboard" className="text-xs text-blue-400 hover:underline">
          Dashboard →
        </Link>
      </div>
      {error && (
        <p className="text-xs text-amber-400 mb-3">
          Can&apos;t reach the backend right now — showing last known tickets.
        </p>
      )}

      <div className="space-y-3 mt-4">
        {active.length === 0 && (
          <p className="text-neutral-500 text-sm">No active alerts right now.</p>
        )}

        {active.map((inc) => {
          const busy = busyTicket === inc.ticket_id;
          const remarks = remarksByTicket[inc.ticket_id] ?? "";

          return (
            <div
              key={inc.ticket_id}
              className={`rounded-lg p-4 border ${
                inc.severity === "CRITICAL"
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-amber-400/40 bg-amber-400/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{inc.ticket_id}</p>
                <span className="text-xs uppercase tracking-wide text-neutral-400">
                  {inc.status}
                </span>
              </div>
              <p className="text-sm text-neutral-400">{inc.sensor_id} · {inc.sector_id}</p>
              <p className="text-sm mt-1">Risk: {inc.risk_score} ({inc.severity})</p>

              {inc.status === "TRIGGERED" && (
                <button
                  disabled={busy}
                  onClick={() => act(inc, { status: "ASSIGNED", assigned_worker_id: workerId })}
                  className="w-full mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md py-2 text-sm font-medium"
                >
                  Take Ticket
                </button>
              )}

              {inc.status === "ESCALATED" && (
                <div className="mt-3 text-sm text-neutral-400">
                  Escalated to Mine Manager
                  <button
                    disabled={busy}
                    onClick={() => act(inc, { status: "ASSIGNED", assigned_worker_id: workerId })}
                    className="w-full mt-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md py-2 text-sm font-medium"
                  >
                    Take Back
                  </button>
                </div>
              )}

              {inc.status === "ASSIGNED" && (
                <>
                  <textarea
                    value={remarks}
                    onChange={(e) =>
                      setRemarksByTicket((prev) => ({ ...prev, [inc.ticket_id]: e.target.value }))
                    }
                    placeholder="Verification notes..."
                    className="w-full mt-3 rounded-md bg-black/30 border border-white/10 p-2 text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      disabled={busy}
                      onClick={() => act(inc, { status: "RESOLVED", field_remarks: remarks })}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md py-2 text-sm font-medium"
                    >
                      Mark Resolved
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => act(inc, { status: "ESCALATED", field_remarks: remarks })}
                      className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-md py-2 text-sm font-medium"
                    >
                      Escalate
                    </button>
                  </div>
                </>
              )}

              {inc.status === "RESOLVED" && (
                <p className="mt-3 text-sm text-emerald-400">
                  Resolved — awaiting manager sign-off.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default function FieldWorkerPage() {
  return (
    <RequireAuth allowedRoles={["field_worker"]}>
      <FieldWorkerView />
    </RequireAuth>
  );
}