export default function ProgressRing({
  percentage,
  size = 56,
  strokeWidth = 6,
  colorClassName = "text-emerald-400",
  label,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  colorClassName?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-white/10"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={colorClassName}
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-semibold">{label ?? `${clamped}%`}</span>
    </div>
  );
}
