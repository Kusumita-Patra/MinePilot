"use client";

import { useEffect, useState } from "react";
import { Plus, Mountain } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ProgressRing from "@/components/ui/ProgressRing";
import {
  createLandMetric,
  getLandHistory,
  getLandSummary,
  getSustainabilityScores,
  getSustainabilityTargets,
  type LandMetric,
  type LandSummary,
  type SustainabilityScore,
  type SustainabilityTarget,
} from "@/lib/sustainabilityApi";

const DATA_SOURCE_BADGE: Record<string, string> = {
  REAL_SENSOR: "bg-emerald-500/15 text-emerald-400",
  SIMULATED_SENSOR: "bg-blue-500/15 text-blue-400",
  MANUAL_ENTRY: "bg-purple-500/15 text-purple-400",
  CALCULATED: "bg-neutral-700/40 text-neutral-400",
  AI_ESTIMATE: "bg-amber-500/15 text-amber-400",
};

const RING_COLOR = (score: number) =>
  score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";

const EMPTY_FORM = {
  total_disturbed_area_ha: "",
  reclaimed_area_ha: "",
  active_reclamation_area_ha: "",
  revegetated_area_ha: "",
  erosion_incidents: "",
};

export default function LandMetricsPanel() {
  const [history, setHistory] = useState<LandMetric[]>([]);
  const [summary, setSummary] = useState<LandSummary | null>(null);
  const [score, setScore] = useState<SustainabilityScore | null>(null);
  const [target, setTarget] = useState<SustainabilityTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    Promise.all([getLandHistory(), getLandSummary(), getSustainabilityScores(), getSustainabilityTargets()])
      .then(([historyData, summaryData, scores, targets]) => {
        setHistory([...historyData].reverse());
        setSummary(summaryData);
        setScore(scores.find((s) => s.category === "LAND") ?? null);
        setTarget(targets.find((t) => t.category === "LAND" && t.metric === "land_reclamation_pct") ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load land data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await createLandMetric({
        recorded_date: new Date().toISOString().slice(0, 10),
        total_disturbed_area_ha: Number(form.total_disturbed_area_ha),
        reclaimed_area_ha: form.reclaimed_area_ha ? Number(form.reclaimed_area_ha) : undefined,
        active_reclamation_area_ha: form.active_reclamation_area_ha ? Number(form.active_reclamation_area_ha) : undefined,
        revegetated_area_ha: form.revegetated_area_ha ? Number(form.revegetated_area_ha) : undefined,
        erosion_incidents: form.erosion_incidents ? Number(form.erosion_incidents) : undefined,
        data_source: "MANUAL_ENTRY",
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save land metric");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Cumulative land disturbance/reclamation snapshots — these are running totals, not daily amounts. Automatic
          simulated readings feed this when the sustainability simulator is running.
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Plus size={14} /> Log current totals
        </button>
      </div>

      {!summary || summary.data_source === null ? (
        <EmptyState
          icon={Mountain}
          title="No land sustainability data available yet"
          description="Waiting for simulated environmental data, or log current disturbed/reclaimed totals manually."
          actionLabel="Log current totals"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Disturbed" value={`${summary.total_disturbed_area_ha.toFixed(1)} ha`} />
            <StatCard label="Reclaimed" value={`${summary.reclaimed_area_ha.toFixed(1)} ha`} />
            <StatCard label="Reclamation %" value={summary.reclamation_rate_pct !== null ? `${summary.reclamation_rate_pct}%` : "—"} />
            <StatCard label="Active reclamation" value={summary.active_reclamation_area_ha !== null ? `${summary.active_reclamation_area_ha.toFixed(1)} ha` : "—"} />
            <div className="bg-gray-900 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              {score && (
                <ProgressRing percentage={score.score_pct} size={44} strokeWidth={5} colorClassName={RING_COLOR(score.score_pct)} />
              )}
              <div>
                <p className="text-[11px] text-neutral-500">Land score</p>
                <Badge
                  label={summary.data_source ?? ""}
                  className={DATA_SOURCE_BADGE[summary.data_source ?? ""] ?? "bg-neutral-700/40 text-neutral-400"}
                />
              </div>
            </div>
          </div>

          {history.length > 1 && (
            <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">DISTURBED VS RECLAIMED AREA (ha)</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={history.map((h) => ({
                    date: h.recorded_date,
                    Disturbed: h.total_disturbed_area_ha,
                    Reclaimed: h.reclaimed_area_ha,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8892a0" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#8892a0" }} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #ffffff20", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {target && (
                    <ReferenceLine
                      y={target.target_value}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: "Reclamation target %", fontSize: 10, fill: "#f59e0b" }}
                    />
                  )}
                  <Area type="monotone" dataKey="Disturbed" stroke="#ef4444" fill="#ef444440" />
                  <Area type="monotone" dataKey="Reclaimed" stroke="#22c55e" fill="#22c55e80" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {history.length > 0 && (
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Sector</th>
                    <th className="px-4 py-2.5 font-medium">Disturbed</th>
                    <th className="px-4 py-2.5 font-medium">Reclaimed</th>
                    <th className="px-4 py-2.5 font-medium">Reclamation %</th>
                    <th className="px-4 py-2.5 font-medium">Erosion</th>
                    <th className="px-4 py-2.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(-15).reverse().map((m) => (
                    <tr key={m.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2.5 text-neutral-300">{m.recorded_date}</td>
                      <td className="px-4 py-2.5 text-neutral-400">{m.sector_id ?? "Mine-wide"}</td>
                      <td className="px-4 py-2.5 text-neutral-300">{m.total_disturbed_area_ha.toFixed(1)} ha</td>
                      <td className="px-4 py-2.5 text-neutral-300">{m.reclaimed_area_ha.toFixed(1)} ha</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-medium">
                        {m.reclamation_rate_pct !== null ? `${m.reclamation_rate_pct}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400">{m.erosion_incidents ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge label={m.data_source} className={DATA_SOURCE_BADGE[m.data_source]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log current land totals">
        <div className="space-y-3">
          {(
            [
              ["total_disturbed_area_ha", "Total disturbed area to date (ha)"],
              ["reclaimed_area_ha", "Reclaimed area to date (ha, optional)"],
              ["active_reclamation_area_ha", "Currently under active reclamation (ha, optional)"],
              ["revegetated_area_ha", "Revegetated area (ha, optional)"],
              ["erosion_incidents", "Erosion incidents (count, optional)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-neutral-400 block mb-1">{label}</label>
              <input
                type="number"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
          <p className="text-[11px] text-neutral-600">
            These are cumulative totals to date, not today&apos;s change. Reclaimed/active/revegetated cannot exceed
            the disturbed total.
          </p>
          <button
            onClick={submit}
            disabled={saving}
            className="w-full mt-2 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-3">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className="text-lg font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}
