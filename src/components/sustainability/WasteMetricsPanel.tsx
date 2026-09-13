"use client";

import { useEffect, useState } from "react";
import { Plus, Recycle } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ProgressRing from "@/components/ui/ProgressRing";
import {
  createWasteMetric,
  getSustainabilityScores,
  getSustainabilityTargets,
  getWasteHistory,
  getWasteSummary,
  type SustainabilityScore,
  type SustainabilityTarget,
  type WasteMetric,
  type WasteSummary,
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
  total_waste_tonnes: "",
  recycled_waste_tonnes: "",
  reused_waste_tonnes: "",
  disposed_waste_tonnes: "",
  hazardous_waste_tonnes: "",
  production_tonnes: "",
};

export default function WasteMetricsPanel() {
  const [history, setHistory] = useState<WasteMetric[]>([]);
  const [summary, setSummary] = useState<WasteSummary | null>(null);
  const [score, setScore] = useState<SustainabilityScore | null>(null);
  const [target, setTarget] = useState<SustainabilityTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    Promise.all([getWasteHistory(), getWasteSummary(), getSustainabilityScores(), getSustainabilityTargets()])
      .then(([historyData, summaryData, scores, targets]) => {
        setHistory([...historyData].reverse());
        setSummary(summaryData);
        setScore(scores.find((s) => s.category === "WASTE") ?? null);
        setTarget(targets.find((t) => t.category === "WASTE" && t.metric === "waste_diversion_pct") ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load waste data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await createWasteMetric({
        recorded_date: new Date().toISOString().slice(0, 10),
        total_waste_tonnes: Number(form.total_waste_tonnes),
        recycled_waste_tonnes: form.recycled_waste_tonnes ? Number(form.recycled_waste_tonnes) : undefined,
        reused_waste_tonnes: form.reused_waste_tonnes ? Number(form.reused_waste_tonnes) : undefined,
        disposed_waste_tonnes: form.disposed_waste_tonnes ? Number(form.disposed_waste_tonnes) : undefined,
        hazardous_waste_tonnes: form.hazardous_waste_tonnes ? Number(form.hazardous_waste_tonnes) : undefined,
        production_tonnes: form.production_tonnes ? Number(form.production_tonnes) : undefined,
        data_source: "MANUAL_ENTRY",
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save waste metric");
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
          Daily waste-accounting entries. Automatic simulated readings feed this when the sustainability simulator is
          running — manual entry always remains available.
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Plus size={14} /> Log today&apos;s metrics
        </button>
      </div>

      {!summary || summary.data_source === null ? (
        <EmptyState
          icon={Recycle}
          title="No waste data available yet"
          description="Waiting for simulated environmental data, or log today's figures manually."
          actionLabel="Log today's metrics"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total waste" value={`${Math.round(summary.total_waste_tonnes).toLocaleString()} t`} />
            <StatCard label="Diversion rate" value={summary.diversion_rate_pct !== null ? `${summary.diversion_rate_pct}%` : "—"} />
            <StatCard label="Recycled" value={`${Math.round(summary.recycled_waste_tonnes).toLocaleString()} t`} />
            <StatCard label="Disposed" value={`${Math.round(summary.disposed_waste_tonnes).toLocaleString()} t`} />
            <div className="bg-gray-900 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              {score && (
                <ProgressRing percentage={score.score_pct} size={44} strokeWidth={5} colorClassName={RING_COLOR(score.score_pct)} />
              )}
              <div>
                <p className="text-[11px] text-neutral-500">Waste score</p>
                <Badge
                  label={summary.data_source ?? ""}
                  className={DATA_SOURCE_BADGE[summary.data_source ?? ""] ?? "bg-neutral-700/40 text-neutral-400"}
                />
              </div>
            </div>
          </div>

          {history.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">WASTE DIVERSION TREND (%)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={history.map((h) => ({ date: h.recorded_date, diversion: h.diversion_rate_pct }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8892a0" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#8892a0" }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #ffffff20", fontSize: 12 }} />
                    {target && <ReferenceLine y={target.target_value} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Target", fontSize: 10, fill: "#f59e0b" }} />}
                    <Area type="monotone" dataKey="diversion" stroke="#22c55e" fill="#22c55e80" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">WASTE COMPOSITION (tonnes)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={history.map((h) => ({
                      date: h.recorded_date,
                      Recycled: h.recycled_waste_tonnes,
                      Reused: h.reused_waste_tonnes,
                      Disposed: h.disposed_waste_tonnes,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8892a0" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#8892a0" }} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #ffffff20", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Recycled" stackId="a" fill="#22c55e" />
                    <Bar dataKey="Reused" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="Disposed" stackId="a" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Sector</th>
                    <th className="px-4 py-2.5 font-medium">Total</th>
                    <th className="px-4 py-2.5 font-medium">Diversion %</th>
                    <th className="px-4 py-2.5 font-medium">Intensity</th>
                    <th className="px-4 py-2.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(-15).reverse().map((m) => (
                    <tr key={m.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2.5 text-neutral-300">{m.recorded_date}</td>
                      <td className="px-4 py-2.5 text-neutral-400">{m.sector_id ?? "Mine-wide"}</td>
                      <td className="px-4 py-2.5 text-neutral-300">{Math.round(m.total_waste_tonnes).toLocaleString()} t</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-medium">
                        {m.diversion_rate_pct !== null ? `${m.diversion_rate_pct}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400">
                        {m.waste_intensity_tonnes_per_tonne !== null ? `${m.waste_intensity_tonnes_per_tonne} t/t` : "—"}
                      </td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log today's waste metrics">
        <div className="space-y-3">
          {(
            [
              ["total_waste_tonnes", "Total waste generated (tonnes)"],
              ["recycled_waste_tonnes", "Recycled (tonnes, optional)"],
              ["reused_waste_tonnes", "Reused (tonnes, optional)"],
              ["disposed_waste_tonnes", "Disposed (tonnes, optional)"],
              ["hazardous_waste_tonnes", "Of which hazardous (tonnes, optional)"],
              ["production_tonnes", "Production (tonnes, optional — for intensity)"],
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
          <p className="text-[11px] text-neutral-600">Recycled + reused + disposed must not exceed the total.</p>
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
