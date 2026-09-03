import { ShieldCheck, Users, ClipboardList, ClipboardCheck } from "lucide-react";
import clsx from "clsx";

interface KpiDef {
  label: string;
  value: string;
  trend: string;
  icon: React.ElementType;
  tone: "emerald" | "red" | "amber" | "blue";
}

const KPIS: KpiDef[] = [
  { label: "Overall Compliance", value: "94%", trend: "+6% from last month", icon: ShieldCheck, tone: "emerald" },
  { label: "Open Violations", value: "12", trend: "+2 from last week", icon: Users, tone: "red" },
  { label: "Pending Actions", value: "7", trend: "+1 from last week", icon: ClipboardList, tone: "amber" },
  { label: "Inspections (This Month)", value: "48", trend: "+12 from last month", icon: ClipboardCheck, tone: "blue" },
];

const TONE_STYLES = {
  emerald: "bg-emerald-500/15 text-emerald-400",
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-400",
  blue: "bg-blue-500/15 text-blue-400",
};

export default function KpiCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {KPIS.map(({ label, value, trend, icon: Icon, tone }) => (
        <div
          key={label}
          className="bg-neutral-900 border border-white/10 rounded-xl p-4 flex items-start gap-3 hover:border-white/20 transition-colors"
        >
          <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TONE_STYLES[tone])}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-neutral-500 text-[11px]">{label}</p>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-[10px] text-neutral-500">{trend}</p>
          </div>
        </div>
      ))}
    </div>
  );
}