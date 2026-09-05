import type { DocumentStatus, MineDocument } from "../../../shared/types/documents";
import ComplianceBadge from "./ComplianceBadge";
import ExpiryCountdown from "./ExpiryCountdown";
import Badge from "../ui/Badge";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  DRAFT: "bg-white/5 text-neutral-400 border border-white/10",
  PENDING_REVIEW: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  REJECTED: "bg-red-500/10 text-red-400 border border-red-500/30",
  ARCHIVED: "bg-white/5 text-neutral-500 border border-white/10",
  SUPERSEDED: "bg-white/5 text-neutral-500 border border-white/10",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
  SUPERSEDED: "Superseded",
};

export default function DocumentTable({
  documents,
  selectedIds,
  onToggleSelect,
  onOpen,
}: {
  documents: MineDocument[];
  selectedIds: Set<string>;
  onToggleSelect: (documentId: string) => void;
  onOpen: (document: MineDocument) => void;
}) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
            <th className="px-3 py-2 w-8"></th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Doc. Number</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Issuing Authority</th>
            <th className="px-3 py-2">Issue Date</th>
            <th className="px-3 py-2">Expiry</th>
            <th className="px-3 py-2">Compliance</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Owner</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr
              key={doc.documentId}
              onClick={() => onOpen(doc)}
              className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer"
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(doc.documentId)}
                  onChange={() => onToggleSelect(doc.documentId)}
                  className="accent-blue-500"
                />
              </td>
              <td className="px-3 py-2 font-medium">{doc.title}</td>
              <td className="px-3 py-2 text-neutral-400 tabular-nums">{doc.documentNumber ?? "—"}</td>
              <td className="px-3 py-2 text-neutral-400">{doc.category.replace(/_/g, " ")}</td>
              <td className="px-3 py-2 text-neutral-400">{doc.issuingAuthority ?? "—"}</td>
              <td className="px-3 py-2 text-neutral-400 tabular-nums">{doc.issueDate ?? "—"}</td>
              <td className="px-3 py-2">
                <ExpiryCountdown daysUntilExpiry={doc.daysUntilExpiry} />
              </td>
              <td className="px-3 py-2">
                <ComplianceBadge state={doc.complianceState} />
              </td>
              <td className="px-3 py-2">
                <Badge label={STATUS_LABEL[doc.status]} className={STATUS_STYLES[doc.status]} />
              </td>
              <td className="px-3 py-2 text-neutral-400">{doc.ownerName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { STATUS_LABEL as DOCUMENT_STATUS_LABEL, STATUS_STYLES as DOCUMENT_STATUS_STYLES };
