"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, Siren, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { EmergencyEvent, EmergencyEventStatus } from "../../../shared/types/emergency";
import { formatSectorId } from "@/lib/format";

const STATUS_STYLE: Record<EmergencyEventStatus, { bg: string; border: string; text: string; label: string }> = {
  DETECTED: { bg: "bg-slate-800", border: "border-slate-600", text: "text-slate-300", label: "Detected" },
  ACTIVE: { bg: "bg-red-950/60", border: "border-red-500/50", text: "text-red-400", label: "Active" },
  ACKNOWLEDGED: { bg: "bg-amber-950/50", border: "border-amber-500/50", text: "text-amber-400", label: "Acknowledged" },
  ESCALATED: { bg: "bg-red-950/70", border: "border-red-500/70", text: "text-red-400", label: "Escalated" },
  EVACUATION_ACTIVE: {
    bg: "bg-orange-950/60",
    border: "border-orange-500/60",
    text: "text-orange-400",
    label: "Evacuation Active",
  },
  RESOLVED: { bg: "bg-emerald-950/40", border: "border-emerald-500/40", text: "text-emerald-400", label: "Resolved" },
  CANCELLED: { bg: "bg-slate-800", border: "border-slate-600", text: "text-slate-400", label: "Cancelled" },
};

function useCountdown(activatedAt: string, timeoutSeconds: number, frozen: boolean) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (frozen) return;
    function tick() {
      const elapsed = (Date.now() - new Date(activatedAt).getTime()) / 1000;
      setRemaining(Math.max(0, Math.round(timeoutSeconds - elapsed)));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activatedAt, timeoutSeconds, frozen]);
  return remaining;
}

export default function EmergencyStatusBanner({
  event,
  actions,
}: {
  event: EmergencyEvent;
  actions?: React.ReactNode;
}) {
  const style = STATUS_STYLE[event.status];
  const escalationFrozen = event.status !== "ACTIVE" || event.escalated_at !== null;
  const remaining = useCountdown(event.activated_at, event.escalation_timeout_seconds, escalationFrozen);
  const isTerminal = event.status === "RESOLVED" || event.status === "CANCELLED";

  return (
    <div className={clsx("rounded-xl border p-4 flex flex-col gap-3", style.bg, style.border)}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className={clsx("mt-0.5", style.text)}>
            {isTerminal ? <ShieldCheck size={22} /> : <Siren size={22} className={!isTerminal ? "animate-pulse" : ""} />}
          </div>
          <div>
            <p className={clsx("text-sm font-semibold uppercase tracking-wide", style.text)}>
              {style.label} — {event.hazard_type.replace(/_/g, " ")}
            </p>
            <p className="text-sm text-neutral-300 mt-0.5">
              {formatSectorId(event.trigger_sector_id)}
              {event.trigger_value !== null && <> · reading {event.trigger_value}</>}
              {event.trigger_sensor_id && <> · sensor {event.trigger_sensor_id}</>}
            </p>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {!escalationFrozen && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Loader2 size={12} className="animate-spin" />
          Auto-escalates in <span className="font-mono text-amber-400">{remaining}s</span> if not acted on
        </div>
      )}
      {event.status === "ESCALATED" && (
        <p className="flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle size={12} /> Escalated automatically — no acknowledgement was made in time.
        </p>
      )}
      {event.status === "RESOLVED" && event.resolution_notes && (
        <p className="text-xs text-neutral-400">Resolution: {event.resolution_notes}</p>
      )}
    </div>
  );
}
