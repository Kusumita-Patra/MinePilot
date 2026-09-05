import clsx from "clsx";
import type { PermitStatus, WorkPermit } from "../../../shared/types/contractors";

const STATUS_STYLES: Record<PermitStatus, string> = {
  REQUESTED: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  EXPIRED: "bg-red-500/10 text-red-400 border border-red-500/30",
  CLOSED: "bg-white/5 text-neutral-400 border border-white/10",
  REVOKED: "bg-red-500/10 text-red-400 border border-red-500/30",
};

function expiringWithinShift(validTo: string): boolean {
  const hours = (new Date(validTo).getTime() - Date.now()) / (1000 * 60 * 60);
  return hours >= 0 && hours <= 12;
}

export default function WorkPermitsTab({ permits }: { permits: WorkPermit[] }) {
  if (permits.length === 0) {
    return <p className="text-sm text-neutral-500">No work permits recorded for this contractor.</p>;
  }

  return (
    <ul className="space-y-2">
      {permits.map((permit) => (
        <li
          key={permit.permitId}
          className={clsx(
            "rounded-lg border p-3",
            permit.status === "ACTIVE" && expiringWithinShift(permit.validTo)
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-white/10 bg-white/5"
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {permit.permitType.replace(/_/g, " ")}{" "}
              <span className="text-neutral-500 font-normal">· {permit.permitNumber}</span>
            </p>
            <span className={clsx("text-[11px] px-2 py-0.5 rounded-full", STATUS_STYLES[permit.status])}>
              {permit.status}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {permit.zoneId ?? "No zone"} · Valid {new Date(permit.validFrom).toLocaleString()} →{" "}
            {new Date(permit.validTo).toLocaleString()}
          </p>
          {permit.status === "ACTIVE" && expiringWithinShift(permit.validTo) && (
            <p className="text-[11px] text-amber-400 mt-1">Expires within this shift</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {permit.precautionsChecklist.map((item) => (
              <span
                key={item.item}
                className={clsx(
                  "text-[10px] px-2 py-0.5 rounded-full",
                  item.confirmed ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-neutral-500"
                )}
              >
                {item.item}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
