import type { LucideIcon } from "lucide-react";

export default function ComingSoon({
  title,
  icon: Icon,
  description,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="bg-gray-900 border border-white/10 rounded-xl p-12 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-500">
          <Icon size={22} />
        </div>
        <p className="text-sm text-neutral-400">{description}</p>
        <p className="text-[11px] text-neutral-600">Coming soon.</p>
      </div>
    </div>
  );
}
