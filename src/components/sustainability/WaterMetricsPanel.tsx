"use client";

import { useEffect, useState } from "react";
import { Plus, Droplets } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { createWaterMetric, getWaterMetrics, type WaterMetric } from "@/lib/sustainabilityApi";

const EMPTY_FORM = {
  water_consumed_m3: "",
  water_extracted_m3: "",
  water_reused_m3: "",
  water_discharged_m3: "",
  rainwater_collected_m3: "",
  production_tonnes: "",
};

export default function WaterMetricsPanel() {
  const [metrics, setMetrics] = useState<WaterMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    getWaterMetrics()
      .then(setMetrics)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load water metrics"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await createWaterMetric({
        recorded_date: new Date().toISOString().slice(0, 10),
        water_consumed_m3: Number(form.water_consumed_m3),
        water_extracted_m3: Number(form.water_extracted_m3),
        water_reused_m3: Number(form.water_reused_m3),
        water_discharged_m3: Number(form.water_discharged_m3),
        rainwater_collected_m3: form.rainwater_collected_m3 ? Number(form.rainwater_collected_m3) : undefined,
        production_tonnes: form.production_tonnes ? Number(form.production_tonnes) : undefined,
        data_source: "MANUAL_ENTRY",
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save water metric");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Daily water-balance entries — manually recorded for now (no live water-flow sensor is wired up yet).
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Plus size={14} /> Log today&apos;s metrics
        </button>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && metrics.length === 0 && (
        <EmptyState icon={Droplets} title="No water metrics yet" description="Log today's water-balance figures to see reuse rate and efficiency." actionLabel="Log today's metrics" onAction={() => setModalOpen(true)} />
      )}

      {!loading && !error && metrics.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Consumed</th>
                <th className="px-4 py-2.5 font-medium">Reused</th>
                <th className="px-4 py-2.5 font-medium">Discharged</th>
                <th className="px-4 py-2.5 font-medium">Reuse %</th>
                <th className="px-4 py-2.5 font-medium">Efficiency</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-300">{m.recorded_date}</td>
                  <td className="px-4 py-2.5 text-neutral-300">{m.water_consumed_m3} m³</td>
                  <td className="px-4 py-2.5 text-neutral-300">{m.water_reused_m3} m³</td>
                  <td className="px-4 py-2.5 text-neutral-300">{m.water_discharged_m3} m³</td>
                  <td className="px-4 py-2.5 text-blue-400 font-medium">{m.reuse_pct !== null ? `${m.reuse_pct}%` : "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-400">{m.efficiency_m3_per_tonne !== null ? `${m.efficiency_m3_per_tonne} m³/t` : "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge label={m.data_source} className="bg-purple-500/15 text-purple-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log today's water metrics">
        <div className="space-y-3">
          {(
            [
              ["water_consumed_m3", "Water consumed (m³)"],
              ["water_extracted_m3", "Water extracted (m³)"],
              ["water_reused_m3", "Water reused (m³)"],
              ["water_discharged_m3", "Water discharged (m³)"],
              ["rainwater_collected_m3", "Rainwater collected (m³, optional)"],
              ["production_tonnes", "Production (tonnes, optional — for efficiency)"],
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
