import { Skull, AlertTriangle, Info } from "lucide-react";
import clsx from "clsx";

interface Alert {
  title: string;
  location: string;
  time: string;
  level: "critical" | "warning" | "info";
}

const ALERTS: Alert[] = [
  { title: "Gas Concentration High", location: "Section 4 - Level -3", time: "10:20 AM", level: "critical" },
  { title: "Ventilation Failure", location: "Section 2 - Level -2", time: "09:45 AM", level: "warning" },
  { title: "Inspection Overdue", location: "Section 6 - Level -4", time: "Yesterday", level: "warning" },
  { title: "Water Quality Report Due", location: "Washery Plant", time: "28 May 2025", level: "info" },
];

const LEVEL_STYLES = {
  critical: { icon: Skull, color: "text-red-500", bg: "bg-red-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
};

export default function RecentAlerts() {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide">RECENT ALERTS</p>
        <button className="text-[11px] text-blue-400 hover:underline">View All</button>
      </div>
      <div className="space-y-1">
        {ALERTS.map((a, i) => {
          const { icon: Icon, color, bg } = LEVEL_STYLES[a.level];
          return (
            <button
              key={i}
              className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition-colors"
            >
              <div className={clsx("w-7 h-7 rounded-md flex items-center justify-center shrink-0", bg)}>
                <Icon size={14} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.title}</p>
                <p className="text-[11px] text-neutral-500 truncate">{a.location}</p>
              </div>
              <span className="text-[10px] text-neutral-600 shrink-0">{a.time}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}