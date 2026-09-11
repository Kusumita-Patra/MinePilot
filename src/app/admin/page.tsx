"use client";

import { useEffect, useState } from "react";
import { Users, MapPinned, WifiOff, AlertOctagon, ScrollText, FolderOpen, HardHat } from "lucide-react";
import Link from "next/link";
import { getAdminDashboard, type AdminDashboardSummary } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-neutral-500 tracking-wide uppercase">{label}</p>
        <Icon size={15} className="text-neutral-600" />
      </div>
      <p className="text-2xl font-semibold text-white mt-2">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminDashboard()
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Admin Command Center</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Mine configuration, access control, and system governance — not a duplicate of the Manager
          Dashboard&apos;s live operational monitoring.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Users" value={summary.total_users} icon={Users} />
            <StatCard label="Mine Managers" value={summary.users_by_role.mine_manager ?? 0} icon={HardHat} />
            <StatCard label="Field Workers" value={summary.users_by_role.field_worker ?? 0} icon={HardHat} />
            <StatCard label="Administrators" value={summary.users_by_role.administrator ?? 0} icon={Users} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">Mine Configuration</p>
              <div className="flex items-center gap-3 text-sm">
                <MapPinned size={16} className="text-amber-400" />
                <div className="flex-1">
                  <p className="text-neutral-200">{summary.active_blueprint_name ?? "No blueprint uploaded"}</p>
                  <p className="text-xs text-neutral-500">
                    {summary.active_blueprint_section_count} traced section
                    {summary.active_blueprint_section_count === 1 ? "" : "s"}
                  </p>
                </div>
                <Link href="/admin/mine/blueprint" className="text-xs text-amber-400 hover:underline shrink-0">
                  Configure →
                </Link>
              </div>
            </div>

            <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
                Pending Admin Actions
              </p>
              <div className="flex items-center gap-3 text-sm">
                <WifiOff size={16} className="text-red-400" />
                <p className="flex-1 text-neutral-200">{summary.offline_sensor_count} sensor(s) offline</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertOctagon size={16} className="text-amber-400" />
                <p className="flex-1 text-neutral-200">{summary.open_incident_count} open incident(s)</p>
              </div>
              <p className="text-[11px] text-neutral-600 pt-1 border-t border-white/5">
                Contractor approvals and document verification tiles are not shown here — no Contractors/
                Documents backend exists yet (still frontend-mock, see CLAUDE.md).
              </p>
            </div>
          </div>

          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
                Recent System Activity
              </p>
              <Link href="/admin/audit-logs" className="text-xs text-amber-400 hover:underline">
                View all →
              </Link>
            </div>
            {summary.recent_audit_logs.length === 0 ? (
              <EmptyState icon={ScrollText} title="No activity yet" description="Administrator actions will appear here." />
            ) : (
              <ul className="space-y-1.5">
                {summary.recent_audit_logs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-white/5 last:border-0">
                    <span className="text-neutral-300">{log.description}</span>
                    <span className="text-neutral-600 shrink-0 tabular-nums">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-center gap-3 text-xs text-neutral-500">
            <FolderOpen size={14} />
            Contractor approvals, document verification, and other compliance workflows still run on frontend
            mock data — see the Compliance Governance section for the admin-manageable governance foundation
            that does have a real backend.
          </div>
        </>
      )}
    </div>
  );
}
