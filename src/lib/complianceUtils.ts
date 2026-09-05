import type { ComplianceState, DocumentStats, MineDocument } from "../../shared/types/documents";
import type { Contractor, ContractorStats, RiskBand } from "../../shared/types/contractors";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const EXPIRING_SOON_THRESHOLD_DAYS = 30;

export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / MS_PER_DAY);
}

export function getComplianceState(
  expiryDate: string | null,
  options: { isApplicable?: boolean; hasDocument?: boolean } = {}
): ComplianceState {
  const { isApplicable = true, hasDocument = true } = options;

  if (!isApplicable) return "NOT_APPLICABLE";
  if (!hasDocument) return "MISSING";
  if (!expiryDate) return "VALID";

  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return "VALID";
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRING_SOON_THRESHOLD_DAYS) return "EXPIRING_SOON";
  return "VALID";
}

export function formatExpiryCountdown(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry === null) return "No expiry";
  if (daysUntilExpiry < 0) {
    const overdue = Math.abs(daysUntilExpiry);
    return `Expired ${overdue} day${overdue === 1 ? "" : "s"} ago`;
  }
  if (daysUntilExpiry === 0) return "Expires today";
  return `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
}

export const COMPLIANCE_STATE_LABEL: Record<ComplianceState, string> = {
  VALID: "Valid",
  EXPIRING_SOON: "Expiring soon",
  EXPIRED: "Expired",
  NOT_APPLICABLE: "Not applicable",
  MISSING: "Missing",
};

export const COMPLIANCE_STATE_STYLES: Record<ComplianceState, string> = {
  VALID: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  EXPIRING_SOON: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  EXPIRED: "bg-red-500/10 text-red-400 border border-red-500/30",
  MISSING: "bg-red-500/10 text-red-400 border border-red-500/30",
  NOT_APPLICABLE: "bg-white/5 text-neutral-400 border border-white/10",
};

// Recomputes daysUntilExpiry/complianceState from expiryDate so the UI stays
// correct even if a backend sends stale precomputed values (or none at all).
export function refreshDocumentCompliance(doc: MineDocument): MineDocument {
  const daysUntilExpiry = getDaysUntilExpiry(doc.expiryDate);
  const complianceState: ComplianceState = doc.expiryDate
    ? getComplianceState(doc.expiryDate)
    : doc.isStatutory
      ? "MISSING"
      : "VALID";
  return { ...doc, daysUntilExpiry, complianceState };
}

export function computeDocumentStats(documents: MineDocument[]): DocumentStats {
  const total = documents.length;
  const valid = documents.filter((d) => d.complianceState === "VALID").length;
  const expiringSoon = documents.filter((d) => d.complianceState === "EXPIRING_SOON").length;
  const expired = documents.filter((d) => d.complianceState === "EXPIRED").length;
  const missing = documents.filter((d) => d.complianceState === "MISSING").length;
  const pendingApproval = documents.filter((d) => d.status === "PENDING_REVIEW").length;
  const compliancePercentage = total > 0 ? Math.round(((valid + expiringSoon) / total) * 100) : 100;
  return { total, valid, expiringSoon, expired, missing, pendingApproval, compliancePercentage };
}

export function computeContractorStats(contractors: Contractor[]): ContractorStats {
  const totalContractors = contractors.length;
  const activeContractors = contractors.filter((c) => c.status === "ACTIVE").length;
  const contractorsWithGaps = contractors.filter(
    (c) => c.overallComplianceState === "EXPIRED" || c.overallComplianceState === "EXPIRING_SOON"
  ).length;
  const suspendedOrBlacklisted = contractors.filter(
    (c) => c.status === "SUSPENDED" || c.status === "BLACKLISTED"
  ).length;
  const totalWorkersOnSite = contractors.reduce((sum, c) => sum + c.workersOnSite, 0);
  const blockedWorkers = contractors.reduce((sum, c) => sum + c.workersBlocked, 0);
  const averageSafetyScore =
    totalContractors > 0
      ? Math.round(contractors.reduce((sum, c) => sum + c.safetyMetrics.safetyScore, 0) / totalContractors)
      : 0;
  const contractsExpiringIn30Days = contractors.filter(
    (c) => c.daysUntilContractEnd !== null && c.daysUntilContractEnd >= 0 && c.daysUntilContractEnd <= 30
  ).length;
  return {
    totalContractors,
    activeContractors,
    contractorsWithGaps,
    suspendedOrBlacklisted,
    totalWorkersOnSite,
    blockedWorkers,
    averageSafetyScore,
    contractsExpiringIn30Days,
  };
}

// TODO(Team 2): replace with POST /predict/contractor-risk once the model is
// wired up. Until then, this deterministic fallback keeps the Safety tab
// populated so the UI never shows a blank "AI risk" panel.
export function computeFallbackRiskScore(
  compliancePercentage: number,
  incidentCount: number
): { score: number; band: RiskBand } {
  const score = Math.round(
    Math.max(0, Math.min(100, (100 - compliancePercentage) * 0.6 + incidentCount * 8))
  );
  const band: RiskBand = score < 25 ? "LOW" : score < 50 ? "MODERATE" : score < 75 ? "HIGH" : "CRITICAL";
  return { score, band };
}
