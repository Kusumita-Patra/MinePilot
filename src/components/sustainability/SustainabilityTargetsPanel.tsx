"use client";

import { useEffect, useState } from "react";
import { Plus, Target } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import {
  createSustainabilityTarget,
  getSustainabilityTargets,
  type SustainabilityCategory,
  type SustainabilityTarget,
  type TargetPeriod,
} from "@/lib/sustainabilityApi";

const CATEGORIES: SustainabilityCategory[] = [
  "WATER",
  "ENERGY",
  "WASTE",
  "LAND",
  "ENVIRONMENTAL",
  "SAFETY",
  "COMPLIANCE",
  "LABOUR",
];
const PERIODS: TargetPeriod[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

const EMPTY_FORM = {
  category: "WATER" as SustainabilityCategory,
  metric: "water_reuse_pct",
  target_value: "",
  unit: "%",
  period: "DAILY" as TargetPeriod,
  warning_percentage: "10",
  critical_percentage: "25",
};

export default function SustainabilityTargetsPanel({ canEdit }: { canEdit: boolean }) {
  const [targets, setTargets] = useState<SustainabilityTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    getSustainabilityTargets()
      .then(setTargets)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sustainability targets"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await createSustainabilityTarget({
        category: form.category,
        metric: form.metric,
        target_value: Number(form.target_value),
        unit: form.unit,
        period: form.period,
        warning_percentage: form.warning_percentage ? Number(form.warning_percentage) : undefined,
        critical_percentage: form.critical_percentage ? Number(form.critical_percentage) : undefined,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save target");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Configurable targets driving the Sustainability Score and dashboard insights. Try{" "}
          <code className="px-1 py-0.5 bg-black/20 rounded">water_reuse_pct</code> to see the Water score and
          insights react to real data.
        </p>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white shrink-0"
          >
            <Plus size={14} /> Add target
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && targets.length === 0 && (
        <EmptyState
          icon={Target}
          title="No sustainability targets configured"
          description={canEdit ? "Add one — e.g. a water reuse % target — to power score comparisons." : undefined}
          actionLabel={canEdit ? "Add target" : undefined}
          onAction={canEdit ? () => setModalOpen(true) : undefined}
        />
      )}

      {!loading && !error && targets.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Metric</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Warning / Critical</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 uppercase tracking-wide">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-200 font-mono text-xs">{t.metric}</td>
                  <td className="px-4 py-2.5 text-neutral-200">
                    {t.target_value}
                    {t.unit}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 text-xs">{t.period}</td>
                  <td className="px-4 py-2.5 text-neutral-400 text-xs">
                    {t.warning_percentage ?? "—"}% / {t.critical_percentage ?? "—"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add sustainability target">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SustainabilityCategory }))}
              className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Metric key</label>
            <input
              value={form.metric}
              onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
              className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Target value</label>
              <input
                type="number"
                value={form.target_value}
                onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Unit</label>
              <input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Period</label>
            <select
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as TargetPeriod }))}
              className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Warning %</label>
              <input
                type="number"
                value={form.warning_percentage}
                onChange={(e) => setForm((f) => ({ ...f, warning_percentage: e.target.value }))}
                className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Critical %</label>
              <input
                type="number"
                value={form.critical_percentage}
                onChange={(e) => setForm((f) => ({ ...f, critical_percentage: e.target.value }))}
                className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <button
            onClick={submit}
            disabled={saving || !form.metric || !form.target_value || !form.unit}
            className="w-full mt-2 px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
