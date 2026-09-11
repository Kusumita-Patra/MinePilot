"use client";

import { useEffect, useState } from "react";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { getAuditLogs, type AuditLogEntry } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";

const PAGE_SIZE = 25;

/** Shared by /admin/audit-logs and a manager/worker's own dashboard when
 * granted `audit_logs.view`. */
export default function AuditLogsPanel() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      getAuditLogs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then(setLogs)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit logs"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [page]);

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && logs.length === 0 && (
        <EmptyState icon={ScrollText} title="No activity recorded" description="Administrator actions will appear here as they happen." />
      )}

      {!loading && !error && logs.length > 0 && (
        <>
          <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Actor</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-400 text-xs whitespace-nowrap capitalize">
                      {log.actor_role.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-400 text-xs font-mono whitespace-nowrap">{log.action}</td>
                    <td className="px-4 py-2.5 text-neutral-200">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-white/10 text-neutral-300 hover:bg-white/5 disabled:opacity-30"
            >
              <ChevronLeft size={13} /> Newer
            </button>
            <span className="text-xs text-neutral-600">Page {page + 1}</span>
            <button
              disabled={logs.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-white/10 text-neutral-300 hover:bg-white/5 disabled:opacity-30"
            >
              Older <ChevronRight size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
