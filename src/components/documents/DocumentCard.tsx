import clsx from "clsx";
import type { MineDocument } from "../../../shared/types/documents";
import ComplianceBadge from "./ComplianceBadge";
import ExpiryCountdown from "./ExpiryCountdown";

const BORDER_TONE: Record<MineDocument["complianceState"], string> = {
  VALID: "border-l-emerald-500",
  EXPIRING_SOON: "border-l-amber-500",
  EXPIRED: "border-l-red-500",
  MISSING: "border-l-red-500",
  NOT_APPLICABLE: "border-l-white/20",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function DocumentCard({ document, onOpen }: { document: MineDocument; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={clsx(
        "text-left bg-gray-900 border border-white/10 border-l-4 rounded-xl p-4 space-y-2 hover:border-white/20 transition-colors",
        BORDER_TONE[document.complianceState]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{document.title}</p>
        <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] shrink-0">
          {initials(document.ownerName)}
        </span>
      </div>
      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-neutral-400">
        {document.category.replace(/_/g, " ")}
      </span>
      <div className="flex items-center justify-between pt-1">
        <ExpiryCountdown daysUntilExpiry={document.daysUntilExpiry} />
        <ComplianceBadge state={document.complianceState} />
      </div>
    </button>
  );
}
