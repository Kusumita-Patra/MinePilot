"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { EnrichedContractorWorker } from "@/hooks/useContractorDetail";
import { formatExpiryCountdown } from "@/lib/complianceUtils";

export default function ContractorWorkforceTab({ workers }: { workers: EnrichedContractorWorker[] }) {
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [onSiteOnly, setOnSiteOnly] = useState(false);

  const filtered = useMemo(() => {
    return workers.filter((w) => {
      if (expiredOnly && w.blockingReasons.length === 0) return false;
      if (onSiteOnly && !w.isOnSite) return false;
      return true;
    });
  }, [workers, expiredOnly, onSiteOnly]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-2 text-neutral-400">
          <input
            type="checkbox"
            checked={expiredOnly}
            onChange={(e) => setExpiredOnly(e.target.checked)}
            className="accent-red-500"
          />
          Expired certificates only
        </label>
        <label className="flex items-center gap-2 text-neutral-400">
          <input
            type="checkbox"
            checked={onSiteOnly}
            onChange={(e) => setOnSiteOnly(e.target.checked)}
            className="accent-emerald-500"
          />
          On site now
        </label>
      </div>

      <div className="bg-black/20 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Designation</th>
              <th className="px-3 py-2">PME Status</th>
              <th className="px-3 py-2">Vocational Training</th>
              <th className="px-3 py-2">Gate Pass</th>
              <th className="px-3 py-2">On Site</th>
              <th className="px-3 py-2">Entry Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => {
              const blocked = w.blockingReasons.length > 0;
              return (
                <tr
                  key={w.workerId}
                  className={clsx(
                    "border-b border-white/5 last:border-0",
                    blocked ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-white/5"
                  )}
                >
                  <td className="px-3 py-2 font-medium">{w.fullName}</td>
                  <td className="px-3 py-2 text-neutral-400">{w.designation}</td>
                  <td className="px-3 py-2 text-neutral-400 tabular-nums">
                    {w.pmeStatus.replace(/_/g, " ")} · {formatExpiryCountdown(w.pmeDaysUntilExpiry)}
                  </td>
                  <td className="px-3 py-2 text-neutral-400">
                    {w.vocationalTraining
                      ? `${w.vocationalTraining.complianceState.replace(/_/g, " ")}`
                      : "Not required"}
                  </td>
                  <td className="px-3 py-2 text-neutral-400 tabular-nums">{w.gatePassNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-400">{w.isOnSite ? `Yes · ${w.currentZoneId}` : "No"}</td>
                  <td className="px-3 py-2">
                    {blocked ? (
                      <span
                        className="text-[11px] text-red-400 font-medium"
                        title={w.blockingReasons.join("; ")}
                      >
                        Not permitted to enter
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-400">Permitted</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                  No workers match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
