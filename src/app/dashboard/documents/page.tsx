"use client";

import { useState } from "react";
import { FolderOpen, LayoutGrid, List, Upload, Archive, Download } from "lucide-react";
import clsx from "clsx";
import type { MineDocument } from "../../../../shared/types/documents";
import { useDocuments } from "@/hooks/useDocuments";
import { useCurrentUser, canUpload, canArchive } from "@/hooks/useCurrentUser";
import DocumentsComplianceStrip from "@/components/documents/DocumentsComplianceStrip";
import DocumentFilters from "@/components/documents/DocumentFilters";
import DocumentTable from "@/components/documents/DocumentTable";
import DocumentGrid from "@/components/documents/DocumentGrid";
import DocumentDetailDrawer from "@/components/documents/DocumentDetailDrawer";
import DocumentUploadModal from "@/components/documents/DocumentUploadModal";
import EmptyState from "@/components/ui/EmptyState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";

function exportToCsv(documents: MineDocument[]) {
  const header = ["Title", "Document Number", "Category", "Status", "Compliance", "Expiry Date", "Owner"];
  const rows = documents.map((d) => [
    d.title,
    d.documentNumber ?? "",
    d.category,
    d.status,
    d.complianceState,
    d.expiryDate ?? "",
    d.ownerName,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "documents-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const currentUser = useCurrentUser();
  const {
    documents,
    allFilteredCount,
    pageCount,
    stats,
    loading,
    error,
    source,
    filters,
    setFilters,
    upload,
    approve,
    reject,
    archiveMany,
  } = useDocuments();

  const [view, setView] = useState<"table" | "grid">("table");
  const [selected, setSelected] = useState<MineDocument | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkArchive() {
    await archiveMany([...selectedIds]);
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Documents</h1>
        {canUpload(currentUser.role) && (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 rounded-md px-4 py-2 text-sm font-medium"
          >
            <Upload size={14} />
            Upload Document
          </button>
        )}
      </div>

      {error && (
        <p className="text-amber-400 text-xs">Can&apos;t reach the backend — showing demo data. ({error})</p>
      )}
      {!error && source === "mock" && (
        <p className="text-neutral-500 text-[11px]">Showing demo data — no live backend connection yet.</p>
      )}

      <DocumentsComplianceStrip stats={stats} />

      <DocumentFilters filters={filters} onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-neutral-400">{selectedIds.size} selected</span>
              <button
                onClick={() => exportToCsv(documents.filter((d) => selectedIds.has(d.documentId)))}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-white/10 text-neutral-300 hover:bg-white/5"
              >
                <Download size={12} /> Export CSV
              </button>
              {canArchive(currentUser.role) && (
                <button
                  onClick={handleBulkArchive}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-white/10 text-neutral-300 hover:bg-white/5"
                >
                  <Archive size={12} /> Archive
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
          <button
            onClick={() => setView("table")}
            className={clsx("p-1.5 rounded", view === "table" ? "bg-white/10 text-white" : "text-neutral-500")}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={clsx("p-1.5 rounded", view === "grid" ? "bg-white/10 text-white" : "text-neutral-500")}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents found"
          description="Try adjusting your filters, or upload the first document."
          actionLabel={canUpload(currentUser.role) ? "Upload Document" : undefined}
          onAction={canUpload(currentUser.role) ? () => setUploadOpen(true) : undefined}
        />
      ) : view === "table" ? (
        <DocumentTable
          documents={documents}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onOpen={setSelected}
        />
      ) : (
        <DocumentGrid documents={documents} onOpen={setSelected} />
      )}

      {!loading && documents.length > 0 && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{allFilteredCount} documents</span>
          <div className="flex items-center gap-2">
            <button
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-30"
            >
              Prev
            </button>
            <span>
              Page {filters.page} of {pageCount}
            </span>
            <button
              disabled={filters.page >= pageCount}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              className="px-2 py-1 rounded-md border border-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

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

      <DocumentUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={upload} />
    </div>
  );
}
