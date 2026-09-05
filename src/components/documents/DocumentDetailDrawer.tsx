"use client";

import { useState } from "react";
import type { MineDocument } from "../../../shared/types/documents";
import Drawer from "../ui/Drawer";
import Tabs from "../ui/Tabs";
import ComplianceBadge from "./ComplianceBadge";
import ExpiryCountdown from "./ExpiryCountdown";
import DocumentVersionHistory from "./DocumentVersionHistory";
import DocumentApprovalChain from "./DocumentApprovalChain";
import DocumentAcknowledgements from "./DocumentAcknowledgements";
import DocumentAuditTrail from "./DocumentAuditTrail";
import { useCurrentUser, canApprove } from "@/hooks/useCurrentUser";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "versions", label: "Versions" },
  { id: "approvals", label: "Approvals" },
  { id: "acknowledgements", label: "Acknowledgements" },
  { id: "audit", label: "Audit Trail" },
];

export default function DocumentDetailDrawer({
  document,
  onClose,
  onApprove,
  onReject,
}: {
  document: MineDocument | null;
  onClose: () => void;
  onApprove: (documentId: string, comment: string | null) => void;
  onReject: (documentId: string, comment: string | null) => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [comment, setComment] = useState("");
  const currentUser = useCurrentUser();

  return (
    <Drawer open={document !== null} onClose={onClose} title={document?.title}>
      {document && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ComplianceBadge state={document.complianceState} />
            <ExpiryCountdown daysUntilExpiry={document.daysUntilExpiry} />
          </div>

          <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

          {activeTab === "overview" && (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] text-neutral-500">Document Number</dt>
                  <dd>{document.documentNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-neutral-500">Category</dt>
                  <dd>{document.category.replace(/_/g, " ")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-neutral-500">Issuing Authority</dt>
                  <dd>{document.issuingAuthority ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-neutral-500">Department</dt>
                  <dd>{document.department ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-neutral-500">Issue Date</dt>
                  <dd className="tabular-nums">{document.issueDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-neutral-500">Expiry Date</dt>
                  <dd className="tabular-nums">{document.expiryDate ?? "No expiry"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-neutral-500">Owner</dt>
                  <dd>{document.ownerName}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-neutral-500">Statutory</dt>
                  <dd>{document.isStatutory ? "Yes" : "No"}</dd>
                </div>
              </dl>

              {document.description && (
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">Description</p>
                  <p className="text-neutral-300">{document.description}</p>
                </div>
              )}

              {document.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {document.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-neutral-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {(document.linkedContractorId ||
                document.linkedZoneIds.length > 0 ||
                document.linkedEquipmentIds.length > 0 ||
                document.linkedIncidentIds.length > 0) && (
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">Linked Entities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {document.linkedContractorId && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-400">
                        Contractor: {document.linkedContractorId}
                      </span>
                    )}
                    {document.linkedZoneIds.map((zone) => (
                      <span key={zone} className="px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-neutral-400">
                        Zone: {zone}
                      </span>
                    ))}
                    {document.linkedEquipmentIds.map((eq) => (
                      <span key={eq} className="px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-neutral-400">
                        Equipment: {eq}
                      </span>
                    ))}
                    {document.linkedIncidentIds.map((inc) => (
                      <span key={inc} className="px-2 py-0.5 rounded-full text-[11px] bg-red-500/10 text-red-400">
                        Incident: {inc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "versions" && <DocumentVersionHistory versions={document.versions} />}

          {activeTab === "approvals" && (
            <div className="space-y-3">
              <DocumentApprovalChain status={document.status} approvals={document.approvals} />
              {document.status === "PENDING_REVIEW" && canApprove(currentUser.role) && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional comment"
                    rows={2}
                    className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(document.documentId, comment || null)}
                      className="bg-emerald-600 hover:bg-emerald-500 rounded-md px-3 py-1.5 text-xs font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(document.documentId, comment || null)}
                      className="bg-red-600 hover:bg-red-500 rounded-md px-3 py-1.5 text-xs font-medium"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "acknowledgements" && (
            <DocumentAcknowledgements
              requiresAcknowledgement={document.requiresAcknowledgement}
              acknowledgements={document.acknowledgements}
            />
          )}

          {activeTab === "audit" && <DocumentAuditTrail entries={document.auditTrail} />}
        </div>
      )}
    </Drawer>
  );
}
