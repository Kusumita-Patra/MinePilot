"use client";

import { useEffect, useState } from "react";
import { Check, X, ShieldCheck, Lock } from "lucide-react";
import { getPermissionMatrix, updatePermission, type RolePermissionMatrixRow } from "@/lib/api";

export default function AdminRolesPage() {
  const [rows, setRows] = useState<RolePermissionMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      getPermissionMatrix()
        .then(setRows)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load permissions"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggle = async (cellId: string | null, nextAllowed: boolean) => {
    if (!cellId) return;
    setSavingId(cellId);
    setError(null);
    try {
      await updatePermission(cellId, nextAllowed);
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          mine_manager: row.mine_manager.id === cellId ? { ...row.mine_manager, allowed: nextAllowed } : row.mine_manager,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update permission");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Roles &amp; Permissions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Only Mine Manager access is admin-editable. Toggling a cell there immediately changes what that role
          can do, no redeploy required — it&apos;s the actual authorization check the API runs on each
          request, not a cosmetic label. Administrator is always a fixed superuser, and Field Inspector is
          fixed to incident transitions only (assign/resolve/escalate) — neither is editable here, by design,
          so an admin can never accidentally lock every administrator out or widen a field inspector&apos;s
          access beyond what the role is meant for.
        </p>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Capability</th>
                <th className="px-4 py-2.5 font-medium text-center">Administrator</th>
                <th className="px-4 py-2.5 font-medium text-center">Mine Manager</th>
                <th className="px-4 py-2.5 font-medium text-center">Field Inspector</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.capability} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-300">{row.label}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      title="Administrator always has full access — fixed, not editable"
                      className="inline-flex items-center gap-1 text-[11px] text-amber-400"
                    >
                      <ShieldCheck size={13} /> Full
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <PermissionToggle
                      cell={row.mine_manager}
                      saving={savingId === row.mine_manager.id}
                      onToggle={(next) => toggle(row.mine_manager.id, next)}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <FixedBadge allowed={row.field_worker.allowed} />
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

function PermissionToggle({
  cell,
  saving,
  onToggle,
}: {
  cell: { id: string | null; allowed: boolean };
  saving: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={!cell.id || saving}
      onClick={() => onToggle(!cell.allowed)}
      title={cell.allowed ? "Click to revoke" : "Click to grant"}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors disabled:opacity-40 ${
        cell.allowed
          ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/25"
          : "bg-white/5 border-white/10 text-neutral-600 hover:bg-white/10"
      }`}
    >
      {saving ? (
        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : cell.allowed ? (
        <Check size={14} />
      ) : (
        <X size={14} />
      )}
    </button>
  );
}

/** Field Inspector's cells are never editable — access is fixed to incident
 * transitions only, by product decision (see backend/app/core/permissions.py's
 * FIELD_WORKER_FIXED_CAPABILITIES). Shown as a locked badge, not a toggle. */
function FixedBadge({ allowed }: { allowed: boolean }) {
  return (
    <span
      title="Field Inspector access is fixed — not editable"
      className={`inline-flex items-center gap-1 text-[11px] ${allowed ? "text-emerald-400" : "text-neutral-600"}`}
    >
      <Lock size={11} />
      {allowed ? <Check size={13} /> : <X size={13} />}
    </span>
  );
}
