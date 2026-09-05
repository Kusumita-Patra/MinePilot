import type { DocumentAcknowledgement } from "../../../shared/types/documents";

export default function DocumentAcknowledgements({
  requiresAcknowledgement,
  acknowledgements,
}: {
  requiresAcknowledgement: boolean;
  acknowledgements: DocumentAcknowledgement[];
}) {
  if (!requiresAcknowledgement) {
    return <p className="text-sm text-neutral-500">This document does not require worker acknowledgement.</p>;
  }

  const total = acknowledgements.length;
  const acknowledged = acknowledgements.filter((a) => a.acknowledgedAt).length;
  const pct = total > 0 ? Math.round((acknowledged / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-neutral-400">
            {acknowledged} of {total} workers acknowledged
          </span>
          <span className="font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="space-y-1.5">
        {acknowledgements.map((ack) => (
          <li
            key={ack.acknowledgementId}
            className="flex items-center justify-between text-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <span>{ack.workerName}</span>
            {ack.acknowledgedAt ? (
              <span className="text-[11px] text-emerald-400">
                Acknowledged · {new Date(ack.acknowledgedAt).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-[11px] text-amber-400">Pending</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
