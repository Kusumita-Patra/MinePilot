"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Radio } from "lucide-react";
import { getAlertRules, updateAlertRule, type AlertRule } from "@/lib/api";

// The only rule_key with a live telemetry field behind it — see backend
// governance_risk_service.py's GAS_CONCENTRATION_RULE_KEY. The rest
// (ventilation, equipment_health, document_expiry, contractor_risk,
// incident_risk) have no telemetry-derived data source to evaluate against
// yet, so they stay governance records only.
const LIVE_RULE_KEYS = new Set(["gas_concentration"]);

/** Shared by /admin/alerts (always editable) and a manager/worker's own
 * dashboard when granted `governance.edit` — read-only otherwise. */
export default function AlertRulesPanel({ canEdit }: { canEdit: boolean }) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { warning: string; critical: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    getAlertRules()
      .then((data) => {
        setRules(data);
        setDrafts(
          Object.fromEntries(
            data.map((r) => [r.id, { warning: r.warning_threshold?.toString() ?? "", critical: r.critical_threshold?.toString() ?? "" }])
          )
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load alert rules"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const save = async (rule: AlertRule) => {
    const draft = drafts[rule.id];
    if (!draft) return;
    setSavingId(rule.id);
    try {
      await updateAlertRule(rule.id, {
        warning_threshold: draft.warning === "" ? undefined : Number(draft.warning),
        critical_threshold: draft.critical === "" ? undefined : Number(draft.critical),
      });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-lg p-3 flex items-start gap-2">
        <Radio size={15} className="text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-200/90">
          <strong>Gas Concentration</strong> is now live-enforced: our own backend (not Team 2&apos;s{" "}
          <code className="px-1 py-0.5 bg-black/20 rounded">risk_scoring.py</code>, which this project still
          never modifies) re-checks every telemetry frame against this threshold and escalates the sensor&apos;s
          risk level when breached — it can only raise Team 2&apos;s assessment, never lower it. Editing the
          value here changes real alerting within ~15s.
        </p>
      </div>
      <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/90">
          The other rules below are still governance records only — Ventilation, Equipment Health, Document
          Expiry, Contractor Risk, and Incident Risk have no live telemetry-derived data source to evaluate
          against yet, so editing them updates the stored record but does not currently change what triggers
          a real alert or incident.
        </p>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Rule</th>
                <th className="px-4 py-2.5 font-medium">Warning</th>
                <th className="px-4 py-2.5 font-medium">Critical</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                {canEdit && <th className="px-4 py-2.5 font-medium text-right">Save</th>}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-200">
                    <div className="flex items-center gap-2">
                      {rule.display_name}
                      {LIVE_RULE_KEYS.has(rule.rule_key) ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">
                          Live
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/40 text-neutral-500 uppercase tracking-wide">
                          Record only
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <input
                        type="number"
                        value={drafts[rule.id]?.warning ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [rule.id]: { ...d[rule.id], warning: e.target.value } }))}
                        className="w-24 bg-neutral-900/70 border border-white/10 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <span className="text-neutral-400">{rule.warning_threshold ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <input
                        type="number"
                        value={drafts[rule.id]?.critical ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [rule.id]: { ...d[rule.id], critical: e.target.value } }))}
                        className="w-24 bg-neutral-900/70 border border-white/10 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <span className="text-neutral-400">{rule.critical_threshold ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 text-xs">{rule.unit ?? "—"}</td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        disabled={savingId === rule.id}
                        onClick={() => save(rule)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white"
                      >
                        {savingId === rule.id ? "Saving…" : "Save"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
