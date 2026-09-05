"use client";

import { useState } from "react";
import { useDocuments } from "@/hooks/useDocuments";
import DocumentTable from "../documents/DocumentTable";
import DocumentDetailDrawer from "../documents/DocumentDetailDrawer";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ContractorDocumentsTab({ contractorId }: { contractorId: string }) {
  const currentUser = useCurrentUser();
  const { documents, loading, approve, reject } = useDocuments({ linkedContractorId: contractorId, pageSize: 100 });
  const [selectedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Parameters<typeof DocumentDetailDrawer>[0]["document"]>(null);

  if (loading) return <p className="text-sm text-neutral-500">Loading documents…</p>;
  if (documents.length === 0) {
    return <p className="text-sm text-neutral-500">No documents linked to this contractor yet.</p>;
  }

  return (
    <>
      <DocumentTable documents={documents} selectedIds={selectedIds} onToggleSelect={() => {}} onOpen={setSelected} />
      <DocumentDetailDrawer
        document={selected}
        onClose={() => setSelected(null)}
        onApprove={(id, comment) =>
          approve(id, {
            approverId: currentUser.userId,
            approverName: currentUser.name,
            approverRole: currentUser.role,
            comment,
          })
        }
        onReject={(id, comment) =>
          reject(id, {
            approverId: currentUser.userId,
            approverName: currentUser.name,
            approverRole: currentUser.role,
            comment,
          })
        }
      />
    </>
  );
}
