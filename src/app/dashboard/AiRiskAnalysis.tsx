interface RiskFactor {
  label: string;
  value: number;
}

const RISK_FACTORS: RiskFactor[] = [
  { label: "Gas Concentration", value: 90 },
  { label: "Ventilation", value: 88 },
  { label: "Past Violations", value: 75 },
  { label: "Overdue Actions", value: 82 },
  { label: "Equipment Health", value: 70 },
];

const RECOMMENDATIONS = [
  "Immediate inspection required",
  "Check ventilation system",
  "Review gas monitoring sensors",
  "Verify corrective actions",
];

export default function AiRiskAnalysis({ riskScore = 70 }: { riskScore?: number }) {
  const status = riskScore >= 75 ? "HIGH RISK" : riskScore >= 40 ? "MODERATE RISK" : "LOW RISK";
  const statusColor = riskScore >= 75 ? "text-red-500" : riskScore >= 40 ? "text-amber-400" : "text-emerald-400";
  const ringColor = riskScore >= 75 ? "#ef4444" : riskScore >= 40 ? "#f59e0b" : "#10b981";

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-col gap-4 w-full lg:w-80 shrink-0">
      <p className="text-xs font-semibold text-neutral-300 tracking-wide">AI RISK ANALYSIS</p>

      <div className="flex flex-col items-center py-2">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
            <path
              d="M18 2.5 a 15.5 15.5 0 1 1 0 31 a 15.5 15.5 0 1 1 0 -31"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="3"
            />
            <path
              d="M18 2.5 a 15.5 15.5 0 1 1 0 31 a 15.5 15.5 0 1 1 0 -31"
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeDasharray={`${riskScore}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-bold">{riskScore}</span>
            <span className="text-[10px] text-neutral-500">/100</span>
          </div>
        </div>
        <p className={`text-sm font-bold mt-2 ${statusColor}`}>{status}</p>
      </div>

      <div className="space-y-2.5">
        {RISK_FACTORS.map((f) => (
          <div key={f.label}>
            <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
              <span>{f.label}</span>
              <span>{f.value}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${f.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-white/10">
        <p className="text-[11px] font-semibold text-neutral-400 mb-2">AI Recommendation</p>
        <ul className="space-y-1.5">
          {RECOMMENDATIONS.map((r) => (
            <li key={r} className="flex items-center gap-2 text-[11px] text-neutral-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <button className="w-full bg-blue-600 hover:bg-blue-500 text-xs font-medium py-2 rounded-lg transition-colors">
        View Full Analysis
      </button>
    </div>
  );
}