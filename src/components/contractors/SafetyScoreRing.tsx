import ProgressRing from "../ui/ProgressRing";

export default function SafetyScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const colorClassName = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return <ProgressRing percentage={score} size={size} colorClassName={colorClassName} label={String(score)} />;
}
