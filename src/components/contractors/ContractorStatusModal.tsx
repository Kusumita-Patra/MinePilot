"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ContractorStatus } from "../../../shared/types/contractors";
import Modal from "../ui/Modal";

const ACTION_LABEL: Record<ContractorStatus, string> = {
  ACTIVE: "Reactivate",
  ONBOARDING: "Reactivate",
  SUSPENDED: "Suspend",
  BLACKLISTED: "Blacklist",
  CONTRACT_EXPIRED: "Mark Contract Expired",
};

export default function ContractorStatusModal({
  open,
  onClose,
  targetStatus,
  companyName,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  targetStatus: ContractorStatus | null;
  companyName: string;
  onConfirm: (status: ContractorStatus, reason: string | null) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresReason = targetStatus === "SUSPENDED" || targetStatus === "BLACKLISTED";

  async function handleConfirm() {
    if (!targetStatus) return;
    if (requiresReason && !reason.trim()) {
      setError("A reason is required for this action.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(targetStatus, reason.trim() || null);
      setReason("");
      setError(null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open && targetStatus !== null}
      onClose={onClose}
      title={targetStatus ? `${ACTION_LABEL[targetStatus]} ${companyName}` : undefined}
      widthClassName="w-full max-w-md"
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-400">
          {targetStatus === "SUSPENDED" &&
            "This will suspend the contractor. All their workers will immediately show as access-revoked."}
          {targetStatus === "BLACKLISTED" &&
            "This will permanently blacklist the contractor. All their workers will immediately show as access-revoked."}
          {(targetStatus === "ACTIVE" || targetStatus === "ONBOARDING") &&
            "This will reactivate the contractor and restore workforce access."}
        </p>
        {requiresReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            rows={3}
            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500/50"
          />
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-white/10 text-neutral-400 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}
