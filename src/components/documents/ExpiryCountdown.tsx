import { formatExpiryCountdown } from "@/lib/complianceUtils";

export default function ExpiryCountdown({ daysUntilExpiry }: { daysUntilExpiry: number | null }) {
  const label = formatExpiryCountdown(daysUntilExpiry);
  const tone =
    daysUntilExpiry === null
      ? "text-neutral-500"
      : daysUntilExpiry < 0
        ? "text-red-400"
        : daysUntilExpiry <= 30
          ? "text-amber-400"
          : "text-neutral-400";
  return <span className={`text-xs tabular-nums ${tone}`}>{label}</span>;
}
