"use client";

import { useState, type DragEvent } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import type { AccessRole, DocumentCategory } from "../../../shared/types/documents";
import type { UploadDocumentInput } from "@/lib/documentsApi";
import Modal from "../ui/Modal";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const CATEGORIES: DocumentCategory[] = [
  "STATUTORY_LICENCE",
  "SAFETY_SOP",
  "RISK_ASSESSMENT",
  "INSPECTION_REPORT",
  "AUDIT_REPORT",
  "TRAINING_CERTIFICATE",
  "EQUIPMENT_CERTIFICATE",
  "BLASTING_RECORD",
  "ENVIRONMENTAL_REPORT",
  "INCIDENT_REPORT",
  "CONTRACTOR_DOCUMENT",
  "DRAWING_PLAN",
  "OTHER",
];

const ACCEPT = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.dwg";
const DEFAULT_ALLOWED_ROLES: AccessRole[] = ["ADMIN", "MINE_MANAGER", "SAFETY_OFFICER", "SUPERVISOR"];

export default function DocumentUploadModal({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (input: UploadDocumentInput) => Promise<unknown>;
}) {
  const currentUser = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("STATUTORY_LICENCE");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isStatutory, setIsStatutory] = useState(true);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setCategory("STATUTORY_LICENCE");
    setDocumentNumber("");
    setIssuingAuthority("");
    setIssueDate("");
    setExpiryDate("");
    setIsStatutory(true);
    setDescription("");
    setFormError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!file) return setFormError("Select a file to upload.");
    if (!title.trim()) return setFormError("Title is required.");
    if (isStatutory && !expiryDate) return setFormError("Statutory documents must have an expiry date.");
    if (issueDate && expiryDate && expiryDate <= issueDate) {
      return setFormError("Expiry date must be after issue date.");
    }

    setSubmitting(true);
    try {
      await onUpload({
        title: title.trim(),
        category,
        documentNumber: documentNumber || null,
        issuingAuthority: issuingAuthority || null,
        issueDate: issueDate || null,
        expiryDate: expiryDate || null,
        department: null,
        ownerId: currentUser.userId,
        ownerName: currentUser.name,
        description: description || null,
        tags: [],
        isStatutory,
        requiresAcknowledgement: false,
        linkedContractorId: null,
        linkedZoneIds: [],
        allowedRoles: DEFAULT_ALLOWED_ROLES,
        file: { fileName: file.name, fileSizeBytes: file.size, mimeType: file.type || "application/octet-stream" },
      });
      handleClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Upload Document" widthClassName="w-full max-w-lg">
      <div className="space-y-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center text-sm transition-colors ${
            dragging ? "border-blue-500 bg-blue-500/5" : "border-white/10"
          }`}
        >
          <UploadCloud size={22} className="mx-auto mb-2 text-neutral-500" />
          {file ? (
            <p className="text-neutral-300">{file.name}</p>
          ) : (
            <p className="text-neutral-500">Drag & drop a file here, or</p>
          )}
          <label className="inline-block mt-2 text-blue-400 hover:underline cursor-pointer text-xs">
            browse files
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-[10px] text-neutral-600 mt-1">PDF, DOCX, XLSX, PNG, JPG, DWG</p>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder="Document number"
            className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
          />
        </div>

        <input
          value={issuingAuthority}
          onChange={(e) => setIssuingAuthority(e.target.value)}
          placeholder="Issuing authority"
          className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-neutral-500">Issue date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-neutral-500">
              Expiry date {isStatutory && <span className="text-red-400">*</span>}
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input
            type="checkbox"
            checked={isStatutory}
            onChange={(e) => setIsStatutory(e.target.checked)}
            className="accent-blue-500"
          />
          This is a statutory document (expiry date required)
        </label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
        />

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-md border border-white/10 text-neutral-400 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Upload
          </button>
        </div>
      </div>
    </Modal>
  );
}
