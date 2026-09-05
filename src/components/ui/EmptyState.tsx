import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-12 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-500">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-sm text-neutral-400">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-blue-600 hover:bg-blue-500 rounded-md px-4 py-2 text-sm font-medium mt-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
