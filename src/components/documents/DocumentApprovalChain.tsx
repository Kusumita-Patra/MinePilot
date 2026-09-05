import { Check } from "lucide-react";
import clsx from "clsx";
import type { DocumentApproval, DocumentStatus } from "../../../shared/types/documents";

const STAGES: { key: DocumentStatus[]; label: string }[] = [
  { key: ["DRAFT"], label: "Draft" },
  { key: ["PENDING_REVIEW"], label: "Review" },
  { key: ["APPROVED"], label: "Approved" },
];

function currentStageIndex(status: DocumentStatus): number {
  if (status === "DRAFT") return 0;
  if (status === "PENDING_REVIEW") return 1;
  if (status === "APPROVED" || status === "SUPERSEDED" || status === "ARCHIVED") return 2;
  return -1; // REJECTED
}

export default function DocumentApprovalChain({
  status,
  approvals,
}: {
  status: DocumentStatus;
  approvals: DocumentApproval[];
}) {
  const activeIdx = currentStageIndex(status);

  return (
    <div className="space-y-4">
      {status === "REJECTED" ? (
        <p className="text-sm text-red-400">This document was rejected. See the decision below.</p>
      ) : (
        <div className="flex items-center">
          {STAGES.map((stage, idx) => (
            <div key={stage.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2",
                    idx < activeIdx
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : idx === activeIdx
                        ? "bg-blue-500/20 border-blue-500 text-blue-400"
                        : "bg-white/5 border-white/10 text-neutral-500"
                  )}
                >
                  {idx < activeIdx ? <Check size={14} /> : idx + 1}
                </div>
                <span className="text-[11px] text-neutral-400">{stage.label}</span>
              </div>
              {idx < STAGES.length - 1 && (
                <div className={clsx("h-0.5 flex-1 mx-1", idx < activeIdx ? "bg-emerald-500" : "bg-white/10")} />
              )}
            </div>
          ))}
        </div>
      )}

      {approvals.length === 0 ? (
        <p className="text-sm text-neutral-500">No approval steps recorded.</p>
      ) : (
        <ul className="space-y-2">
          {approvals.map((a) => (
            <li key={a.approvalId} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {a.approverName} <span className="text-neutral-500 font-normal">· {a.approverRole}</span>
                </p>
                <span
                  className={clsx(
                    "text-[11px] px-2 py-0.5 rounded-full",
                    a.decision === "APPROVED"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : a.decision === "REJECTED"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-400"
                  )}
                >
                  {a.decision}
                </span>
              </div>
              {a.decidedAt && (
                <p className="text-[11px] text-neutral-500 mt-1">{new Date(a.decidedAt).toLocaleString()}</p>
              )}
              {a.comment && <p className="text-xs text-neutral-400 mt-1">{a.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
