// Contractor compliance & workforce types — company registry, statutory
// compliance checklist, workers (PME/VT/gate-pass/competency), work permits,
// equipment and safety scorecards. Cross-links into documents.ts via
// documentId / linkedContractorId.

import type { ComplianceState } from "./documents";

export type ContractorStatus =
  | "ACTIVE"
  | "ONBOARDING"
  | "SUSPENDED"
  | "BLACKLISTED"
  | "CONTRACT_EXPIRED";

export type ComplianceItemKey =
  | "CLRA_LICENCE"
  | "WORKMENS_COMPENSATION"
  | "PUBLIC_LIABILITY_INSURANCE"
  | "EPF_REGISTRATION"
  | "ESIC_REGISTRATION"
  | "GST_REGISTRATION"
  | "SAFETY_INDUCTION"
  | "SAFETY_AGREEMENT"
  | "EXPLOSIVE_LICENCE";

export type WorkerFitnessStatus =
  | "FIT"
  | "FIT_WITH_RESTRICTIONS"
  | "UNFIT"
  | "PENDING_PME";

export type PermitType =
  | "HOT_WORK"
  | "CONFINED_SPACE"
  | "WORKING_AT_HEIGHT"
  | "ELECTRICAL_ISOLATION"
  | "EXCAVATION"
  | "BLASTING"
  | "LIFTING";

export type PermitStatus =
  | "REQUESTED"
  | "ACTIVE"
  | "EXPIRED"
  | "CLOSED"
  | "REVOKED";

export type RiskBand = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface CertificateRecord {
  certificateId: string;
  certificateType: string; // e.g. "PME_FORM_O", "VOCATIONAL_TRAINING", "GAS_TESTING"
  certificateNumber: string | null;
  issuedBy: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  complianceState: ComplianceState;
  documentId: string | null; // links to MineDocument
}

export interface ContractorWorker {
  workerId: string;
  contractorId: string;
  fullName: string;
  designation: string;
  skillCategory: "SKILLED" | "SEMI_SKILLED" | "UNSKILLED" | "SUPERVISORY" | "STATUTORY_POST";
  dateOfJoining: string;
  contactNumber: string | null;

  pmeStatus: WorkerFitnessStatus;
  pmeExpiryDate: string | null;
  vocationalTraining: CertificateRecord | null;
  competencyCertificates: CertificateRecord[];

  gatePassNumber: string | null;
  gatePassExpiryDate: string | null;

  isOnSite: boolean;
  currentZoneId: string | null;
  lastSeenAt: string | null;

  isPermittedToEnter: boolean; // false if any mandatory certificate expired
  blockingReasons: string[];
}

export interface ContractorComplianceItem {
  key: ComplianceItemKey;
  label: string;
  isApplicable: boolean;
  complianceState: ComplianceState;
  referenceNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiry: number | null;
  documentId: string | null;
  notes: string | null;
}

export interface WorkPermit {
  permitId: string;
  permitNumber: string;
  permitType: PermitType;
  contractorId: string;
  zoneId: string | null;
  status: PermitStatus;
  issuedBy: string;
  issuedAt: string;
  validFrom: string;
  validTo: string;
  assignedWorkerIds: string[];
  precautionsChecklist: { item: string; confirmed: boolean }[];
  closedAt: string | null;
  remarks: string | null;
}

export interface ContractorSafetyMetrics {
  manHoursTotal: number;
  manHoursThisMonth: number;
  incidentCount: number;
  nearMissCount: number;
  firstAidCaseCount: number;
  lostTimeInjuryCount: number;
  fatalityCount: number;
  ltifr: number; // per million man-hours
  safetyObservationsRaised: number;
  safetyObservationsClosed: number;
  violationCount: number;
  safetyScore: number; // 0-100
  scoreTrend: { month: string; score: number }[];
  aiRiskScore: number | null; // supplied by Team 2's model
  aiRiskBand: RiskBand | null;
  aiRiskFactors: string[]; // human-readable drivers
}

export interface ContractorEquipment {
  equipmentId: string;
  contractorId: string;
  equipmentName: string;
  equipmentType: string;
  registrationNumber: string | null;
  fitnessCertificateExpiry: string | null;
  lastInspectionDate: string | null;
  complianceState: ComplianceState;
  currentZoneId: string | null;
  isOperational: boolean;
}

export interface ContractorContact {
  name: string;
  designation: string;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface Contractor {
  contractorId: string;
  companyName: string;
  shortCode: string;
  status: ContractorStatus;

  registrationNumber: string | null;
  gstin: string | null;
  pan: string | null;
  clraLicenceNumber: string | null;

  contractNumber: string;
  scopeOfWork: string;
  contractValue: number | null;
  contractCurrency: string; // "INR"
  contractStartDate: string;
  contractEndDate: string;
  daysUntilContractEnd: number | null;

  address: string | null;
  contacts: ContractorContact[];

  assignedZoneIds: string[];

  complianceItems: ContractorComplianceItem[];
  compliancePercentage: number; // 0-100
  overallComplianceState: ComplianceState;

  totalWorkers: number;
  workersOnSite: number;
  workersBlocked: number;

  safetyMetrics: ContractorSafetyMetrics;
  documentIds: string[];

  suspensionReason: string | null;
  suspendedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ContractorStats {
  totalContractors: number;
  activeContractors: number;
  contractorsWithGaps: number;
  suspendedOrBlacklisted: number;
  totalWorkersOnSite: number;
  blockedWorkers: number;
  averageSafetyScore: number;
  contractsExpiringIn30Days: number;
}

export interface ContractorListResponse {
  contractors: Contractor[];
  stats: ContractorStats;
  totalCount: number;
}
