// Document compliance types — statutory licences, SOPs, certificates and
// their approval/version/acknowledgement/audit lifecycle. Mirrors the shape
// contractors.ts cross-links against (linkedContractorId / documentId).

export type DocumentCategory =
  | "STATUTORY_LICENCE"
  | "SAFETY_SOP"
  | "RISK_ASSESSMENT"
  | "INSPECTION_REPORT"
  | "AUDIT_REPORT"
  | "TRAINING_CERTIFICATE"
  | "EQUIPMENT_CERTIFICATE"
  | "BLASTING_RECORD"
  | "ENVIRONMENTAL_REPORT"
  | "INCIDENT_REPORT"
  | "CONTRACTOR_DOCUMENT"
  | "DRAWING_PLAN"
  | "OTHER";

export type DocumentStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED"
  | "SUPERSEDED";

export type ComplianceState =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "NOT_APPLICABLE"
  | "MISSING";

export type AccessRole =
  | "ADMIN"
  | "MINE_MANAGER"
  | "SAFETY_OFFICER"
  | "SUPERVISOR"
  | "CONTRACTOR"
  | "VIEWER";

export type AuditAction =
  | "VIEWED"
  | "DOWNLOADED"
  | "UPLOADED"
  | "EDITED"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED"
  | "VERSION_ADDED";

export interface DocumentVersion {
  versionId: string;
  versionNumber: number;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string; // ISO 8601
  changeNote: string | null;
  isCurrent: boolean;
}

export interface DocumentApproval {
  approvalId: string;
  approverId: string;
  approverName: string;
  approverRole: AccessRole;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  decidedAt: string | null;
  comment: string | null;
  stepOrder: number;
}

export interface DocumentAcknowledgement {
  acknowledgementId: string;
  workerId: string;
  workerName: string;
  contractorId: string | null;
  acknowledgedAt: string | null;
  method: "DIGITAL_SIGNATURE" | "BIOMETRIC" | "SUPERVISOR_CONFIRMED";
}

export interface DocumentAuditEntry {
  entryId: string;
  action: AuditAction;
  performedBy: string;
  performedByRole: AccessRole;
  timestamp: string;
  details: string | null;
  ipAddress: string | null;
}

export interface MineDocument {
  documentId: string;
  title: string;
  documentNumber: string | null;
  category: DocumentCategory;
  status: DocumentStatus;
  complianceState: ComplianceState;

  issuingAuthority: string | null;
  issueDate: string | null; // ISO date
  expiryDate: string | null; // ISO date; null = no expiry
  daysUntilExpiry: number | null; // computed server-side or client-side

  department: string | null;
  ownerId: string;
  ownerName: string;
  description: string | null;
  tags: string[];

  isStatutory: boolean;
  requiresAcknowledgement: boolean;
  acknowledgementPercentage: number | null; // 0-100

  // Cross-links into the rest of the platform
  linkedContractorId: string | null;
  linkedZoneIds: string[];
  linkedEquipmentIds: string[];
  linkedIncidentIds: string[];

  allowedRoles: AccessRole[];

  currentVersion: DocumentVersion;
  versions: DocumentVersion[];
  approvals: DocumentApproval[];
  acknowledgements: DocumentAcknowledgement[];
  auditTrail: DocumentAuditEntry[];

  createdAt: string;
  updatedAt: string;
}

export interface DocumentStats {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  missing: number;
  pendingApproval: number;
  compliancePercentage: number; // 0-100
}

export interface DocumentFilterState {
  searchQuery: string;
  categories: DocumentCategory[];
  statuses: DocumentStatus[];
  complianceStates: ComplianceState[];
  departments: string[];
  issuingAuthorities: string[];
  linkedContractorId: string | null;
  linkedZoneId: string | null;
  expiringWithinDays: number | null;
  issueDateFrom: string | null;
  issueDateTo: string | null;
  sortBy: "expiryDate" | "title" | "createdAt" | "category";
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface DocumentListResponse {
  documents: MineDocument[];
  stats: DocumentStats;
  totalCount: number;
  page: number;
  pageSize: number;
}
