import { FileText, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import clsx from "clsx";
import type { DocumentStats } from "../../../shared/types/documents";

const TILES = [
  { key: "total" as const, label: "Total Documents", icon: FileText, tone: "blue" as const },
  { key: "valid" as const, label: "Valid / Compliant", icon: ShieldCheck, tone: "emerald" as const },
  { key: "expiringSoon" as const, label: "Expiring Within 30 Days", icon: AlertTriangle, tone: "amber" as const },
  { key: "expired" as const, label: "Expired or Missing", icon: XCircle, tone: "red" as const },
];

const TONE_STYLES = {
  emerald: "bg-emerald-500/15 text-emerald-400",
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-400",
  blue: "bg-blue-500/15 text-blue-400",
};

export default function DocumentsComplianceStrip({ stats }: { stats: DocumentStats }) {
  const values: Record<string, number> = {
    total: stats.total,
    valid: stats.valid,
    expiringSoon: stats.expiringSoon,
    expired: stats.expired + stats.missing,
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TILES.map(({ key, label, icon: Icon, tone }) => (
          <div
            key={key}
            className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-start gap-3 hover:border-white/20 transition-colors"
          >
            <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TONE_STYLES[tone])}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-neutral-500 text-[11px]">{label}</p>
              <p className="text-2xl font-bold leading-tight">{values[key]}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-neutral-400">Overall Compliance</span>
          <span className="font-semibold tabular-nums">{stats.compliancePercentage}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all",
              stats.compliancePercentage >= 80
                ? "bg-emerald-500"
                : stats.compliancePercentage >= 50
                  ? "bg-amber-500"
                  : "bg-red-500"
            )}
            style={{ width: `${stats.compliancePercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
