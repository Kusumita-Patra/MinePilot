import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export default function Badge({
  label,
  className,
  icon: Icon,
}: {
  label: string;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
        className
      )}
    >
      {Icon && <Icon size={11} />}
      {label}
    </span>
  );
}
