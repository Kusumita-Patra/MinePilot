import clsx from "clsx";

export default function SkeletonLoader({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse bg-white/5 rounded-md", className)} />;
}
