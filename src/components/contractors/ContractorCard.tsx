import Link from "next/link";
import clsx from "clsx";
import type { Contractor } from "../../../shared/types/contractors";
import ProgressRing from "../ui/ProgressRing";
import SafetyScoreRing from "./SafetyScoreRing";
import { formatExpiryCountdown } from "@/lib/complianceUtils";

const STATUS_STYLES: Record<Contractor["status"], string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  ONBOARDING: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  SUSPENDED: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  BLACKLISTED: "bg-red-500/10 text-red-400 border border-red-500/30",
  CONTRACT_EXPIRED: "bg-white/5 text-neutral-400 border border-white/10",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ContractorCard({ contractor }: { contractor: Contractor }) {
  const restricted = contractor.status === "SUSPENDED" || contractor.status === "BLACKLISTED";

  return (
    <Link
      href={`/dashboard/contractors/${contractor.contractorId}`}
      className={clsx(
        "block bg-gray-900 border rounded-xl overflow-hidden hover:border-white/20 transition-colors",
        restricted ? "border-red-500/40" : "border-white/10"
      )}
    >
      {restricted && (
        <div className="bg-red-600/20 text-red-400 text-[11px] font-medium text-center py-1">
          {contractor.status === "BLACKLISTED" ? "Blacklisted" : "Suspended"}
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold shrink-0">
              {initials(contractor.companyName)}
            </span>
            <div>
              <p className="text-sm font-medium leading-snug">{contractor.companyName}</p>
              <p className="text-[11px] text-neutral-500">{contractor.scopeOfWork}</p>
            </div>
          </div>
        </div>

        <span className={clsx("inline-block px-2 py-0.5 rounded-full text-[11px]", STATUS_STYLES[contractor.status])}>
          {contractor.status.replace(/_/g, " ")}
        </span>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <ProgressRing percentage={contractor.compliancePercentage} size={44} strokeWidth={5} />
            <SafetyScoreRing score={contractor.safetyMetrics.safetyScore} size={44} />
          </div>
          <div className="text-right text-[11px] text-neutral-500">
            <p>{contractor.workersOnSite} on site</p>
            <p className="tabular-nums">{formatExpiryCountdown(contractor.daysUntilContractEnd)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
