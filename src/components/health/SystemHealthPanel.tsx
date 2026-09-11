"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { getSystemHealth, type ComponentHealth, type ComponentHealthStatus } from "@/lib/api";

const STATUS_STYLE: Record<ComponentHealthStatus, { dot: string; label: string; text: string }> = {
  healthy: { dot: "bg-emerald-400", label: "Operational", text: "text-emerald-400" },
  degraded: { dot: "bg-amber-400", label: "Degraded", text: "text-amber-400" },
  unavailable: { dot: "bg-red-400", label: "Unavailable", text: "text-red-400" },
};

const POLL_INTERVAL_MS = 15_000;

/** Shared by /admin/system-health and a manager/worker's own dashboard when
 * granted `system_health.view`. */
export default function SystemHealthPanel() {
  const [components, setComponents] = useState<ComponentHealth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      getSystemHealth()
        .then((res) => {
          if (cancelled) return;
          setComponents(res.components);
          setError(null);
          setLastChecked(new Date());
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to check system health");
        });
    };
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-4">
      {lastChecked && <p className="text-xs text-neutral-600 text-right">Checked {lastChecked.toLocaleTimeString()}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {components.map((c) => {
          const style = STATUS_STYLE[c.status];
          return (
            <div key={c.name} className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <Activity size={18} className="text-neutral-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-200">{c.name}</p>
                <p className="text-xs text-neutral-500 truncate">{c.detail}</p>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-medium shrink-0 ${style.text}`}>
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                {style.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
