"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, ShieldAlert, Siren, Unlock } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import {
  blockEvacuationEdge,
  getEmergencyRules,
  getEvacuationGraph,
  updateEmergencyRule,
  updateEvacuationExit,
} from "@/lib/emergencyApi";
import type { EmergencyRule, EvacuationEdge, EvacuationExit } from "../../../../../shared/types/emergency";
import { formatSectorId } from "@/lib/format";

type TabId = "rules" | "exits" | "overrides";

export default function AdminEmergencySafetyPage() {
  const [tab, setTab] = useState<TabId>("rules");
  const [rules, setRules] = useState<EmergencyRule[]>([]);
  const [exits, setExits] = useState<EvacuationExit[]>([]);
  const [edges, setEdges] = useState<EvacuationEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [rulesData, graph] = await Promise.all([getEmergencyRules(), getEvacuationGraph()]);
      setRules(rulesData);
      setExits(graph.exits);
      setEdges(graph.edges);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load emergency configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRuleSave(rule: EmergencyRule, patch: RulePatch) {
    try {
      await updateEmergencyRule(rule.id, patch);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update rule");
    }
  }

  async function handleExitToggle(exit: EvacuationExit) {
    try {
      await updateEvacuationExit(exit.id, { is_active: !exit.is_active });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update exit");
    }
  }

  async function handleEdgeBlockToggle(edge: EvacuationEdge) {
    const reason = edge.manually_blocked ? undefined : window.prompt("Reason for blocking this tunnel segment?") ?? undefined;
    if (!edge.manually_blocked && reason === undefined) return;
    try {
      await blockEvacuationEdge(edge.id, !edge.manually_blocked, reason);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update tunnel override");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonLoader className="h-8 w-64" />
        <SkeletonLoader className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <Siren size={18} /> Emergency Safety Configuration
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Detection thresholds, evacuation exits, and temporary tunnel overrides for the Emergency Safety &
          Evacuation module.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      <Tabs
        tabs={[
          { id: "rules", label: "Detection Rules" },
          { id: "exits", label: "Evacuation Exits" },
          { id: "overrides", label: "Tunnel Overrides" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "rules" && (
        <div className="bg-gray-900 border border-white/10 rounded-xl divide-y divide-white/5">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onSave={(patch) => handleRuleSave(rule, patch)} />
          ))}
        </div>
      )}

      {tab === "exits" && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 text-xs border-b border-white/10">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Sector</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {exits.map((exit) => (
                <tr key={exit.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">{exit.name}</td>
                  <td className="px-4 py-2.5 text-neutral-400">{formatSectorId(exit.sector_id)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        exit.is_active
                          ? "text-emerald-400 text-xs font-medium"
                          : "text-neutral-500 text-xs font-medium"
                      }
                    >
                      {exit.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleExitToggle(exit)}
                      className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10"
                    >
                      {exit.is_active ? "Disable" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-neutral-600 border-t border-white/10">
            Exits are seeded from the demo evacuation graph. Creating new exits requires tracing a graph node first —
            not built in this pass; see the module's known limitations.
          </p>
        </div>
      )}

      {tab === "overrides" && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-start gap-2">
            <ShieldAlert size={14} className="text-amber-400 mt-0.5" />
            <p className="text-xs text-neutral-400">
              A manual block is a <span className="text-amber-400 font-medium">TEMPORARY EMERGENCY OVERRIDE</span> —
              it excludes the tunnel from every evacuation route calculation until reopened, exactly like a
              CRITICAL hazard would. Use for a known physical obstruction (collapse, flooding) not yet reflected by
              a sensor reading.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 text-xs border-b border-white/10">
                <th className="px-4 py-2 font-medium">Sector</th>
                <th className="px-4 py-2 font-medium">Distance</th>
                <th className="px-4 py-2 font-medium">Live hazard</th>
                <th className="px-4 py-2 font-medium">Manual override</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {edges.map((edge) => (
                <tr key={edge.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-400">{formatSectorId(edge.sector_id)}</td>
                  <td className="px-4 py-2.5 text-neutral-400 tabular-nums">{edge.distance}m</td>
                  <td className="px-4 py-2.5">
                    {edge.hazard_level ? (
                      <span
                        className={
                          edge.hazard_level === "CRITICAL"
                            ? "text-red-400 text-xs"
                            : edge.hazard_level === "WARNING"
                              ? "text-amber-400 text-xs"
                              : "text-emerald-400 text-xs"
                        }
                      >
                        {edge.hazard_level}
                      </span>
                    ) : (
                      <span className="text-neutral-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {edge.manually_blocked ? (
                      <span className="text-red-400 text-xs font-medium" title={edge.blocked_reason ?? undefined}>
                        BLOCKED
                      </span>
                    ) : (
                      <span className="text-neutral-600 text-xs">Open</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleEdgeBlockToggle(edge)}
                      className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 inline-flex items-center gap-1"
                    >
                      {edge.manually_blocked ? (
                        <>
                          <Unlock size={11} /> Reopen
                        </>
                      ) : (
                        <>
                          <Ban size={11} /> Block
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type RulePatch = Partial<{
  warning_threshold: number;
  critical_threshold: number;
  unit: string;
  escalation_timeout_seconds: number;
  is_active: boolean;
}>;

function RuleRow({ rule, onSave }: { rule: EmergencyRule; onSave: (patch: RulePatch) => void }) {
  const [critical, setCritical] = useState(String(rule.critical_threshold ?? ""));
  const [warning, setWarning] = useState(String(rule.warning_threshold ?? ""));
  const [timeout_, setTimeout_] = useState(String(rule.escalation_timeout_seconds));
  const dirty =
    critical !== String(rule.critical_threshold ?? "") ||
    warning !== String(rule.warning_threshold ?? "") ||
    timeout_ !== String(rule.escalation_timeout_seconds);

  return (
    <div className="p-4 flex flex-wrap items-end gap-4">
      <div className="min-w-[160px]">
        <p className="text-sm font-medium">{rule.display_name}</p>
        <p className="text-xs text-neutral-500">
          {rule.is_active ? "Active" : "Inactive"} · unit {rule.unit ?? "—"}
        </p>
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Warning threshold</label>
        <input
          value={warning}
          onChange={(e) => setWarning(e.target.value)}
          className="w-28 bg-black/30 border border-white/10 rounded-md px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Critical threshold</label>
        <input
          value={critical}
          onChange={(e) => setCritical(e.target.value)}
          className="w-28 bg-black/30 border border-white/10 rounded-md px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-neutral-400 block mb-1">Escalation timeout (s)</label>
        <input
          value={timeout_}
          onChange={(e) => setTimeout_(e.target.value)}
          className="w-28 bg-black/30 border border-white/10 rounded-md px-2 py-1.5 text-sm"
        />
      </div>
      <button
        disabled={!dirty}
        onClick={() =>
          onSave({
            warning_threshold: warning ? parseFloat(warning) : undefined,
            critical_threshold: critical ? parseFloat(critical) : undefined,
            escalation_timeout_seconds: timeout_ ? parseInt(timeout_, 10) : undefined,
          })
        }
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium"
      >
        Save
      </button>
    </div>
  );
}
