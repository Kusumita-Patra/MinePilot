import type { Contractor } from "../../../shared/types/contractors";
import ProgressRing from "../ui/ProgressRing";
import ComplianceBadge from "../documents/ComplianceBadge";
import ExpiryCountdown from "../documents/ExpiryCountdown";

export default function ContractorComplianceTab({ contractor }: { contractor: Contractor }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ProgressRing percentage={contractor.compliancePercentage} size={64} />
        <div>
          <p className="text-sm font-medium">Overall Compliance</p>
          <ComplianceBadge state={contractor.overallComplianceState} />
        </div>
      </div>

      <ul className="space-y-1.5">
        {contractor.complianceItems.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <div>
              <p className="text-sm">{item.label}</p>
              {item.referenceNumber && (
                <p className="text-[11px] text-neutral-500 tabular-nums">{item.referenceNumber}</p>
              )}
              {item.notes && <p className="text-[11px] text-neutral-500">{item.notes}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ExpiryCountdown daysUntilExpiry={item.daysUntilExpiry} />
              <ComplianceBadge state={item.complianceState} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
