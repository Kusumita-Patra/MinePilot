import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, HelpCircle, type LucideIcon } from "lucide-react";
import type { ComplianceState } from "../../../shared/types/documents";
import { COMPLIANCE_STATE_LABEL, COMPLIANCE_STATE_STYLES } from "@/lib/complianceUtils";
import Badge from "../ui/Badge";

const ICONS: Record<ComplianceState, LucideIcon> = {
  VALID: CheckCircle2,
  EXPIRING_SOON: AlertTriangle,
  EXPIRED: XCircle,
  MISSING: HelpCircle,
  NOT_APPLICABLE: MinusCircle,
};

export default function ComplianceBadge({ state }: { state: ComplianceState }) {
  return (
    <Badge label={COMPLIANCE_STATE_LABEL[state]} icon={ICONS[state]} className={COMPLIANCE_STATE_STYLES[state]} />
  );
}
