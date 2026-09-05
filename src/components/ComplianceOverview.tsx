"use client";

import Link from "next/link";

// PLAN.md §7 item 10: nothing in the backend computes compliance-by-category
// scores yet (compliance_scores has no writer) - this stays hardcoded until
// that's designed and confirmed.
const COMPLIANCE = [
  { label: "Safety Compliance", value: 95 },
  { label: "Environment Compliance", value: 91 },
  { label: "Labour Compliance", value: 93 },
  { label: "Statutory Compliance", value: 97 },
  { label: "Production Compliance", value: 89 },
];

export default function ComplianceOverview({ showViewAll = true }: { showViewAll?: boolean }) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide">COMPLIANCE OVERVIEW</p>
        {showViewAll && (
          <Link href="/dashboard/compliance" className="text-[11px] text-blue-400 hover:underline">
            View All
          </Link>
        )}
      </div>
      <div className="space-y-3">
        {COMPLIANCE.map((c) => (
          <div key={c.label}>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>{c.label}</span>
              <span>{c.value}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
