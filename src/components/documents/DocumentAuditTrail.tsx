import type { DocumentAuditEntry } from "../../../shared/types/documents";

const ACTION_LABEL: Record<DocumentAuditEntry["action"], string> = {
  VIEWED: "Viewed",
  DOWNLOADED: "Downloaded",
  UPLOADED: "Uploaded",
  EDITED: "Edited",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
  VERSION_ADDED: "New version added",
};

export default function DocumentAuditTrail({ entries }: { entries: DocumentAuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500">No audit events recorded.</p>;
  }

  const sorted = [...entries].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return (
    <ul className="space-y-2">
      {sorted.map((entry) => (
        <li key={entry.entryId} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{ACTION_LABEL[entry.action]}</span>
            <span className="text-[11px] text-neutral-500">{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {entry.performedBy} · {entry.performedByRole}
            {entry.ipAddress && ` · ${entry.ipAddress}`}
          </p>
          {entry.details && <p className="text-xs text-neutral-400 mt-1">{entry.details}</p>}
        </li>
      ))}
    </ul>
  );
}
