import { Users, HardHat, AlertTriangle, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import type { ContractorStats } from "../../../shared/types/contractors";

const TONE_STYLES = {
  emerald: "bg-emerald-500/15 text-emerald-400",
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-400",
  blue: "bg-blue-500/15 text-blue-400",
};

export default function ContractorStatsStrip({ stats }: { stats: ContractorStats }) {
  const tiles = [
    { label: "Active Contractors", value: stats.activeContractors, icon: Users, tone: "blue" as const },
    { label: "Workers On Site Today", value: stats.totalWorkersOnSite, icon: HardHat, tone: "emerald" as const },
    { label: "Compliance Gaps", value: stats.contractorsWithGaps, icon: AlertTriangle, tone: "red" as const },
    { label: "Avg. Safety Score", value: `${stats.averageSafetyScore}`, icon: ShieldCheck, tone: "amber" as const },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-start gap-3 hover:border-white/20 transition-colors"
        >
          <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TONE_STYLES[tone])}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-neutral-500 text-[11px]">{label}</p>
            <p className="text-2xl font-bold leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
