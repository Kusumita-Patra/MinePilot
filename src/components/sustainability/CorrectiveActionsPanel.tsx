"use client";

import { useEffect, useState } from "react";
import { Plus, ClipboardCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import {
  createCorrectiveAction,
  getCorrectiveActions,
  transitionCorrectiveAction,
  verifyCorrectiveAction,
  type CorrectiveAction,
  type CorrectiveActionSourceType,
} from "@/lib/sustainabilityApi";

const SOURCE_TYPES: CorrectiveActionSourceType[] = ["MANUAL", "ENVIRONMENTAL_REQUIREMENT", "INCIDENT", "INSPECTION"];

const PRIORITY_STYLE: Record<string, string> = {
  LOW: "bg-neutral-700/40 text-neutral-400",
  MEDIUM: "bg-blue-500/15 text-blue-400",
  HIGH: "bg-amber-500/15 text-amber-400",
  CRITICAL: "bg-red-500/15 text-red-400",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-neutral-700/40 text-neutral-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-400",
  COMPLETED: "bg-amber-500/15 text-amber-400",
  VERIFIED: "bg-emerald-500/15 text-emerald-400",
  CANCELLED: "bg-neutral-800 text-neutral-500",
};

const EMPTY_FORM = {
  source_type: "MANUAL" as CorrectiveActionSourceType,
  title: "",
  description: "",
  verification_required: true,
};

export default function CorrectiveActionsPanel({ canManage }: { canManage: boolean }) {
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    getCorrectiveActions()
      .then(setActions)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load corrective actions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      await createCorrectiveAction({
        source_type: form.source_type,
        title: form.title,
        description: form.description || undefined,
        verification_required: form.verification_required,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create corrective action");
    } finally {
      setSaving(false);
    }
  };

  const advance = async (action: CorrectiveAction) => {
    setBusyId(action.id);
    try {
      if (action.status === "OPEN") await transitionCorrectiveAction(action.id, "IN_PROGRESS");
      else if (action.status === "IN_PROGRESS") await transitionCorrectiveAction(action.id, "COMPLETED");
      else if (action.status === "COMPLETED") await verifyCorrectiveAction(action.id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update corrective action");
    } finally {
      setBusyId(null);
    }
  };

  const nextActionLabel: Record<string, string> = {
    OPEN: "Start",
    IN_PROGRESS: "Mark complete",
    COMPLETED: "Verify",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Reusable corrective-action tracker — shared across safety incidents, environmental breaches, and
          manual entries. &quot;Overdue&quot; is computed live from the due date, not a stored status.
        </p>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shrink-0"
          >
            <Plus size={14} /> New action
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && actions.length === 0 && (
        <EmptyState icon={ClipboardCheck} title="No corrective actions yet" actionLabel={canManage ? "New action" : undefined} onAction={canManage ? () => setModalOpen(true) : undefined} />
      )}

      {!loading && !error && actions.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-200">
                    {a.title}
                    {a.is_overdue && <span className="ml-2 text-[10px] text-red-400 uppercase tracking-wide">Overdue</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 text-xs">{a.source_type}</td>
                  <td className="px-4 py-2.5">
                    <Badge label={a.priority} className={PRIORITY_STYLE[a.priority]} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge label={a.status} className={STATUS_STYLE[a.status]} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {nextActionLabel[a.status] && (
                      <button
                        disabled={busyId === a.id}
                        onClick={() => advance(a)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 disabled:opacity-50 text-neutral-200"
                      >
                        {busyId === a.id ? "…" : nextActionLabel[a.status]}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New corrective action">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Source</label>
            <select
              value={form.source_type}
              onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value as CorrectiveActionSourceType }))}
              className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-neutral-900/70 border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={form.verification_required}
              onChange={(e) => setForm((f) => ({ ...f, verification_required: e.target.checked }))}
            />
            Requires field verification once completed
          </label>
          <button
            onClick={submit}
            disabled={saving || !form.title}
            className="w-full mt-2 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
          >
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
