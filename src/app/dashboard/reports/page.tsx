"use client";

import { useKpis } from "@/hooks/useKpis";
import { useIncidents } from "@/hooks/useIncidents";

function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default function ReportsPage() {
  const { data: kpis } = useKpis();
  const { incidents } = useIncidents();

  function downloadCsv() {
    const rows = [
      ["Ticket", "Sensor", "Sector", "Severity", "Status", "Risk Score", "Created At"],
      ...incidents.map((i) => [
        i.ticket_id,
        i.sensor_id,
        i.sector_id,
        i.severity,
        i.status,
        String(i.risk_score),
        i.created_at,
      ]),
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minepilot-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openIncidents = incidents.filter((i) => i.status !== "SIGNED_OFF");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold">Reports</h1>
        <div className="flex gap-2">
          <button
            onClick={downloadCsv}
            className="bg-white/10 hover:bg-white/20 rounded-md px-4 py-2 text-sm font-medium"
          >
            Download CSV
          </button>
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-500 rounded-md px-4 py-2 text-sm font-medium"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-white/10 rounded-xl p-6 space-y-6 print:bg-white print:text-black">
        <div>
          <h2 className="text-base font-semibold">MinePilot — Site Status Report</h2>
          <p className="text-xs text-neutral-500 print:text-neutral-700">
            Generated {new Date().toLocaleString()}
          </p>
        </div>

        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Overall Compliance" value={`${kpis.overall_compliance.value}%`} />
            <Metric label="Open Violations" value={String(kpis.open_violations.value)} />
            <Metric label="Pending Actions" value={String(kpis.pending_actions.value)} />
            <Metric label="Inspections (This Month)" value={String(kpis.inspections_this_month.value)} />
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-neutral-300 print:text-black tracking-wide mb-2">
            OPEN INCIDENTS ({openIncidents.length})
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 print:border-neutral-300 text-left text-[11px] text-neutral-500 print:text-neutral-600 uppercase">
                <th className="py-2">Ticket</th>
                <th className="py-2">Sector</th>
                <th className="py-2">Severity</th>
                <th className="py-2">Status</th>
                <th className="py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {openIncidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-neutral-500">
                    No open incidents.
                  </td>
                </tr>
              ) : (
                openIncidents.map((i) => (
                  <tr key={i.ticket_id} className="border-b border-white/5 print:border-neutral-200">
                    <td className="py-2">{i.ticket_id}</td>
                    <td className="py-2">{i.sector_id.replace(/_/g, " ")}</td>
                    <td className="py-2">{i.severity}</td>
                    <td className="py-2">{i.status}</td>
                    <td className="py-2">{i.risk_score}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 print:bg-neutral-100 rounded-lg p-3">
      <p className="text-neutral-500 print:text-neutral-600 text-[11px]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
