"use client";

import { useRouter } from "next/navigation";
import { ClipboardPlus, ShieldAlert, UploadCloud, FileBarChart } from "lucide-react";

const ACTIONS = [
  {
    label: "New Inspection",
    icon: ClipboardPlus,
    tone: "text-blue-400 bg-blue-500/10",
    href: "/dashboard/inspections",
  },
  {
    label: "New Violation",
    icon: ShieldAlert,
    tone: "text-red-400 bg-red-500/10",
    href: "/dashboard/violations",
    title: "Violations are detected automatically from sensor telemetry — this opens the violations list.",
  },
  {
    label: "Upload Document",
    icon: UploadCloud,
    tone: "text-emerald-400 bg-emerald-500/10",
    href: "/dashboard/documents",
  },
  {
    label: "Generate Report",
    icon: FileBarChart,
    tone: "text-purple-400 bg-purple-500/10",
    href: "/dashboard/reports",
  },
];

export default function QuickActions() {
  const router = useRouter();

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">QUICK ACTIONS</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ACTIONS.map(({ label, icon: Icon, tone, href, title }) => (
          <button
            key={label}
            title={title}
            onClick={() => router.push(href)}
            className="flex flex-col items-center gap-2 p-3 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors"
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
              <Icon size={16} />
            </span>
            <span className="text-[11px] text-neutral-300 text-center">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
