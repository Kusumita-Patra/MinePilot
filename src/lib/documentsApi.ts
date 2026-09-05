import type {
  AccessRole,
  DocumentApproval,
  DocumentCategory,
  DocumentVersion,
  MineDocument,
} from "../../shared/types/documents";
import { apiFetch } from "./api";
import { refreshDocumentCompliance } from "./complianceUtils";
import mockDocumentsRaw from "../../shared/mock-data/sample-documents.json";

const MOCK_DOCUMENTS = mockDocumentsRaw as MineDocument[];

export interface ApiResult<T> {
  data: T;
  source: "api" | "mock";
}

// No real Documents backend exists yet (see PLAN.md - this is net-new scope).
// Every function below tries the real endpoint first so it starts working
// with zero frontend changes the moment Team 3 ships it, and falls back to
// an in-memory copy of the mock JSON so uploads/approvals persist for the
// life of the tab without a backend.
let sessionDocuments: MineDocument[] | null = null;
function getSessionDocuments(): MineDocument[] {
  if (!sessionDocuments) {
    sessionDocuments = MOCK_DOCUMENTS.map((d) => refreshDocumentCompliance(d));
  }
  return sessionDocuments;
}

export async function getDocuments(): Promise<ApiResult<MineDocument[]>> {
  try {
    // TODO(Team 3): GET /api/documents -> DocumentListResponse
    const data = await apiFetch<MineDocument[]>("/api/documents");
    return { data: data.map(refreshDocumentCompliance), source: "api" };
  } catch {
    return { data: getSessionDocuments(), source: "mock" };
  }
}

export async function getDocument(documentId: string): Promise<ApiResult<MineDocument | undefined>> {
  try {
    // TODO(Team 3): GET /api/documents/{documentId} -> MineDocument
    const data = await apiFetch<MineDocument>(`/api/documents/${documentId}`);
    return { data: refreshDocumentCompliance(data), source: "api" };
  } catch {
    return { data: getSessionDocuments().find((d) => d.documentId === documentId), source: "mock" };
  }
}

export interface UploadDocumentInput {
  title: string;
  category: DocumentCategory;
  documentNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  department: string | null;
  ownerId: string;
  ownerName: string;
  description: string | null;
  tags: string[];
  isStatutory: boolean;
  requiresAcknowledgement: boolean;
  linkedContractorId: string | null;
  linkedZoneIds: string[];
  allowedRoles: AccessRole[];
  file: { fileName: string; fileSizeBytes: number; mimeType: string };
}

export async function uploadDocument(input: UploadDocumentInput): Promise<ApiResult<MineDocument>> {
  // TODO(Team 3): POST /api/documents (multipart: metadata fields + file) -> MineDocument
  try {
    const formData = new FormData();
    Object.entries(input).forEach(([key, value]) => {
      if (key === "file") return;
      formData.append(key, typeof value === "string" ? value : JSON.stringify(value));
    });
    const data = await apiFetch<MineDocument>("/api/documents", { method: "POST", body: formData, headers: {} });
    return { data: refreshDocumentCompliance(data), source: "api" };
  } catch {
    const now = new Date().toISOString();
    const version: DocumentVersion = {
      versionId: `${input.title}-v1-${Date.now()}`,
      versionNumber: 1,
      fileName: input.file.fileName,
      fileUrl: `/mock-files/${input.file.fileName}`,
      fileSizeBytes: input.file.fileSizeBytes,
      mimeType: input.file.mimeType,
      uploadedBy: input.ownerName,
      uploadedAt: now,
      changeNote: null,
      isCurrent: true,
    };
    const newDoc: MineDocument = refreshDocumentCompliance({
      documentId: `doc-local-${Date.now()}`,
      title: input.title,
      documentNumber: input.documentNumber,
      category: input.category,
      status: "PENDING_REVIEW",
      complianceState: "VALID",
      issuingAuthority: input.issuingAuthority,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      daysUntilExpiry: null,
      department: input.department,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      description: input.description,
      tags: input.tags,
      isStatutory: input.isStatutory,
      requiresAcknowledgement: input.requiresAcknowledgement,
      acknowledgementPercentage: input.requiresAcknowledgement ? 0 : null,
      linkedContractorId: input.linkedContractorId,
      linkedZoneIds: input.linkedZoneIds,
      linkedEquipmentIds: [],
      linkedIncidentIds: [],
      allowedRoles: input.allowedRoles,
      currentVersion: version,
      versions: [version],
      approvals: [],
      acknowledgements: [],
      auditTrail: [
        {
          entryId: `audit-${Date.now()}`,
          action: "UPLOADED",
          performedBy: input.ownerName,
          performedByRole: "MINE_MANAGER",
          timestamp: now,
          details: null,
          ipAddress: null,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    getSessionDocuments().unshift(newDoc);
    return { data: newDoc, source: "mock" };
  }
}

export async function addDocumentVersion(
  documentId: string,
  input: { fileName: string; fileSizeBytes: number; mimeType: string; uploadedBy: string; changeNote: string | null }
): Promise<ApiResult<DocumentVersion | undefined>> {
  try {
    // TODO(Team 3): POST /api/documents/{id}/versions (multipart) -> DocumentVersion
    const data = await apiFetch<DocumentVersion>(`/api/documents/${documentId}/versions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { data, source: "api" };
  } catch {
    const docs = getSessionDocuments();
    const doc = docs.find((d) => d.documentId === documentId);
    if (!doc) return { data: undefined, source: "mock" };
    const now = new Date().toISOString();
    const nextVersionNumber = doc.currentVersion.versionNumber + 1;
    const newVersion: DocumentVersion = {
      versionId: `${documentId}-v${nextVersionNumber}`,
      versionNumber: nextVersionNumber,
      fileName: input.fileName,
      fileUrl: `/mock-files/${input.fileName}`,
      fileSizeBytes: input.fileSizeBytes,
      mimeType: input.mimeType,
      uploadedBy: input.uploadedBy,
      uploadedAt: now,
      changeNote: input.changeNote,
      isCurrent: true,
    };
    doc.versions = [...doc.versions.map((v) => ({ ...v, isCurrent: false })), newVersion];
    doc.currentVersion = newVersion;
    doc.updatedAt = now;
    doc.auditTrail = [
      ...doc.auditTrail,
      {
        entryId: `audit-${Date.now()}`,
        action: "VERSION_ADDED",
        performedBy: input.uploadedBy,
        performedByRole: "MINE_MANAGER",
        timestamp: now,
        details: input.changeNote,
        ipAddress: null,
      },
    ];
    return { data: newVersion, source: "mock" };
  }
}

export async function updateDocument(
  documentId: string,
  patch: Partial<MineDocument>
): Promise<ApiResult<MineDocument | undefined>> {
  try {
    // TODO(Team 3): PATCH /api/documents/{id} -> MineDocument
    const data = await apiFetch<MineDocument>(`/api/documents/${documentId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return { data: refreshDocumentCompliance(data), source: "api" };
  } catch {
    const docs = getSessionDocuments();
    const idx = docs.findIndex((d) => d.documentId === documentId);
    if (idx === -1) return { data: undefined, source: "mock" };
    docs[idx] = refreshDocumentCompliance({ ...docs[idx], ...patch, updatedAt: new Date().toISOString() });
    return { data: docs[idx], source: "mock" };
  }
}

async function decide(
  documentId: string,
  decision: "APPROVED" | "REJECTED",
  approver: { approverId: string; approverName: string; approverRole: AccessRole; comment: string | null }
): Promise<ApiResult<DocumentApproval | undefined>> {
  const path = decision === "APPROVED" ? "approve" : "reject";
  try {
    // TODO(Team 3): POST /api/documents/{id}/approve|reject -> DocumentApproval
    const data = await apiFetch<DocumentApproval>(`/api/documents/${documentId}/${path}`, {
      method: "POST",
      body: JSON.stringify(approver),
    });
    return { data, source: "api" };
  } catch {
    const docs = getSessionDocuments();
    const doc = docs.find((d) => d.documentId === documentId);
    if (!doc) return { data: undefined, source: "mock" };
    const now = new Date().toISOString();
    const approval: DocumentApproval = {
      approvalId: `approval-${Date.now()}`,
      approverId: approver.approverId,
      approverName: approver.approverName,
      approverRole: approver.approverRole,
      decision,
      decidedAt: now,
      comment: approver.comment,
      stepOrder: doc.approvals.length + 1,
    };
    doc.approvals = [...doc.approvals, approval];
    doc.status = decision === "APPROVED" ? "APPROVED" : "REJECTED";
    doc.updatedAt = now;
    doc.auditTrail = [
      ...doc.auditTrail,
      {
        entryId: `audit-${Date.now()}`,
        action: decision === "APPROVED" ? "APPROVED" : "REJECTED",
        performedBy: approver.approverName,
        performedByRole: approver.approverRole,
        timestamp: now,
        details: approver.comment,
        ipAddress: null,
      },
    ];
    return { data: approval, source: "mock" };
  }
}

export function approveDocument(
  documentId: string,
  approver: { approverId: string; approverName: string; approverRole: AccessRole; comment: string | null }
) {
  return decide(documentId, "APPROVED", approver);
}

export function rejectDocument(
  documentId: string,
  approver: { approverId: string; approverName: string; approverRole: AccessRole; comment: string | null }
) {
  return decide(documentId, "REJECTED", approver);
}
