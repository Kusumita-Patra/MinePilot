"use client";

import { useEffect, useState } from "react";
import { Plus, Leaf } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import {
  createEnvironmentalRequirement,
  getEnvironmentalRequirements,
  type EnvironmentalCategory,
  type EnvironmentalRequirement,
} from "@/lib/sustainabilityApi";

const CATEGORIES: EnvironmentalCategory[] = [
  "AIR",
  "WATER",
  "WASTE",
  "EMISSIONS",
  "LAND",
  "NOISE",
  "BIODIVERSITY",
  "RECLAMATION",
  "OTHER",
];

const EMPTY_FORM = {
  category: "AIR" as EnvironmentalCategory,
  name: "",
  parameter: "",
  unit: "",
  warning_threshold: "",
  critical_threshold: "",
  regulatory_reference: "",
  authority: "",
};

export default function EnvironmentalRequirementsPanel({ canEdit }: { canEdit: boolean }) {
  const [requirements, setRequirements] = useState<EnvironmentalRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    setLoading(true);
    getEnvironmentalRequirements()
      .then(setRequirements)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load environmental requirements"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await createEnvironmentalRequirement({
        category: form.category,
        name: form.name,
        parameter: form.parameter,
        unit: form.unit,
        warning_threshold: form.warning_threshold ? Number(form.warning_threshold) : undefined,
        critical_threshold: form.critical_threshold ? Number(form.critical_threshold) : undefined,
        regulatory_reference: form.regulatory_reference || undefined,
        authority: form.authority || undefined,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save requirement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Administrator-configured environmental thresholds — never invented statutory limits, only what an
          administrator enters here (with an optional regulatory reference).
        </p>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
          >
            <Plus size={14} /> Add requirement
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && requirements.length === 0 && (
        <EmptyState
          icon={Leaf}
          title="No environmental requirements configured"
          description={canEdit ? "Add one to start tracking environmental compliance." : "An administrator hasn't configured any yet."}
          actionLabel={canEdit ? "Add requirement" : undefined}
          onAction={canEdit ? () => setModalOpen(true) : undefined}
        />
      )}

      {!loading && !error && requirements.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Parameter</th>
                <th className="px-4 py-2.5 font-medium">Warning</th>
                <th className="px-4 py-2.5 font-medium">Critical</th>
                <th className="px-4 py-2.5 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr key={req.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 uppercase tracking-wide">
                      {req.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-200">{req.name}</td>
                  <td className="px-4 py-2.5 text-neutral-400">
                    {req.parameter} <span className="text-neutral-600">({req.unit})</span>
                  </td>
                  <td className="px-4 py-2.5 text-amber-400">{req.warning_threshold ?? "—"}</td>
                  <td className="px-4 py-2.5 text-red-400">{req.critical_threshold ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-500 text-xs">{req.regulatory_reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add environmental requirement">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as EnvironmentalCategory }))}
              className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {(
            [
              ["name", "Name", "text"],
              ["parameter", "Parameter key (e.g. pm10)", "text"],
              ["unit", "Unit (e.g. µg/m³)", "text"],
              ["warning_threshold", "Warning threshold (optional)", "number"],
              ["critical_threshold", "Critical threshold (optional)", "number"],
              ["regulatory_reference", "Regulatory reference (optional)", "text"],
              ["authority", "Authority (optional)", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs text-neutral-400 block mb-1">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          ))}
          <button
            onClick={submit}
            disabled={saving || !form.name || !form.parameter || !form.unit}
            className="w-full mt-2 px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
