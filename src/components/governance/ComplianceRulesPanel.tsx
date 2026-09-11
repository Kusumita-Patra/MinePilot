"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  getComplianceRequirements,
  createComplianceRequirement,
  updateComplianceRequirement,
  type ComplianceRequirement,
  type ComplianceRequirementAppliesTo,
} from "@/lib/api";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

/** Shared by /admin/compliance (always editable) and a manager/worker's own
 * dashboard when granted `governance.edit` — read-only otherwise. */
export default function ComplianceRulesPanel({ canEdit }: { canEdit: boolean }) {
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = () => {
    setLoading(true);
    getComplianceRequirements()
      .then(setRequirements)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleActive = async (req: ComplianceRequirement) => {
    if (!canEdit) return;
    try {
      await updateComplianceRequirement(req.id, { is_active: !req.is_active });
      refresh();
    } catch {
      // Surfaced via the list simply not updating; the row stays as-is.
    }
  };

  const groups: Record<ComplianceRequirementAppliesTo, ComplianceRequirement[]> = {
    WORKER: requirements.filter((r) => r.applies_to === "WORKER"),
    CONTRACTOR: requirements.filter((r) => r.applies_to === "CONTRACTOR"),
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Plus size={14} />
            Add Requirement
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading &&
        !error &&
        (["WORKER", "CONTRACTOR"] as const).map((group) => (
          <div key={group} className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
              {group === "WORKER" ? "Worker Requirements" : "Contractor Requirements"}
            </p>
            {groups[group].length === 0 ? (
              <p className="text-xs text-neutral-600">None configured.</p>
            ) : (
              <ul className="space-y-1.5">
                {groups[group].map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 text-sm bg-white/5 rounded-md px-3 py-2"
                  >
                    <span className="text-neutral-200">{r.document_type}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-neutral-500">
                        Warn {r.warning_threshold_days}d · Critical {r.critical_threshold_days}d
                      </span>
                      {canEdit ? (
                        <button onClick={() => toggleActive(r)}>
                          <Badge
                            label={r.is_active ? "Active" : "Inactive"}
                            className={r.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-500/15 text-neutral-400"}
                          />
                        </button>
                      ) : (
                        <Badge
                          label={r.is_active ? "Active" : "Inactive"}
                          className={r.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-500/15 text-neutral-400"}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

      {canEdit && <CreateRequirementModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />}
    </div>
  );
}

function CreateRequirementModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [appliesTo, setAppliesTo] = useState<ComplianceRequirementAppliesTo>("WORKER");
  const [documentType, setDocumentType] = useState("");
  const [warningDays, setWarningDays] = useState("30");
  const [criticalDays, setCriticalDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDocumentType("");
    setWarningDays("30");
    setCriticalDays("7");
    setError(null);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await createComplianceRequirement({
        applies_to: appliesTo,
        document_type: documentType.trim(),
        warning_threshold_days: Number(warningDays),
        critical_threshold_days: Number(criticalDays),
      });
      reset();
      onClose();
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add requirement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add compliance requirement">
      <div className="space-y-3">
        <label className="block text-xs text-neutral-400">
          Applies to
          <select
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as ComplianceRequirementAppliesTo)}
            className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          >
            <option value="WORKER">Worker</option>
            <option value="CONTRACTOR">Contractor</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Document type
          <input
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            placeholder="e.g. Medical Examination"
            className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </label>
        <div className="flex gap-2">
          <label className="block text-xs text-neutral-400 flex-1">
            Warning threshold (days)
            <input
              type="number"
              value={warningDays}
              onChange={(e) => setWarningDays(e.target.value)}
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block text-xs text-neutral-400 flex-1">
            Critical threshold (days)
            <input
              type="number"
              value={criticalDays}
              onChange={(e) => setCriticalDays(e.target.value)}
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </label>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          disabled={!documentType.trim() || busy}
          onClick={handleCreate}
          className="w-full px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
        >
          {busy ? "Adding…" : "Add requirement"}
        </button>
      </div>
    </Modal>
  );
}
