"use client";

import { useState } from "react";
import { useIncidents } from "@/hooks/useIncidents";
import { updateIncident } from "@/lib/api";

export default function IncidentSignOff() {
  const { incidents, refresh } = useIncidents();
  const [busy, setBusy] = useState<string | null>(null);

  const pending = incidents.filter((i) => i.status === "RESOLVED" || i.status === "ESCALATED");

  async function signOff(ticketId: string) {
    setBusy(ticketId);
    try {
      await updateIncident(ticketId, { status: "SIGNED_OFF" });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">NEEDS SIGN-OFF</p>
      {pending.length === 0 ? (
        <p className="text-[11px] text-neutral-600 px-1 py-3">Nothing waiting on you right now.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((inc) => (
            <div
              key={inc.ticket_id}
              className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-white/5"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {inc.ticket_id} · {inc.sector_id}
                </p>
                <p className="text-[11px] text-neutral-500 truncate">
                  {inc.status} · risk {inc.risk_score}
                </p>
              </div>
              <button
                disabled={busy === inc.ticket_id}
                onClick={() => signOff(inc.ticket_id)}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-md px-3 py-1.5 text-[11px] font-medium shrink-0"
              >
                Sign Off
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}