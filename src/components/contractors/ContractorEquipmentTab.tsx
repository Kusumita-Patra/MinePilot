import type { EnrichedContractorEquipment } from "@/hooks/useContractorDetail";
import ComplianceBadge from "../documents/ComplianceBadge";
import ExpiryCountdown from "../documents/ExpiryCountdown";

export default function ContractorEquipmentTab({ equipment }: { equipment: EnrichedContractorEquipment[] }) {
  if (equipment.length === 0) {
    return <p className="text-sm text-neutral-500">No equipment recorded for this contractor.</p>;
  }

  return (
    <ul className="space-y-2">
      {equipment.map((eq) => (
        <li
          key={eq.equipmentId}
          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium">{eq.equipmentName}</p>
            <p className="text-[11px] text-neutral-500">
              {eq.equipmentType} · {eq.registrationNumber ?? "No registration"} ·{" "}
              {eq.isOperational ? "Operational" : "Not operational"}
              {eq.currentZoneId && ` · ${eq.currentZoneId}`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <ExpiryCountdown daysUntilExpiry={eq.fitnessDaysUntilExpiry} />
            <ComplianceBadge state={eq.complianceState} />
          </div>
        </li>
      ))}
    </ul>
  );
}
