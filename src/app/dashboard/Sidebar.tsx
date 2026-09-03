"use client";

import {
  LayoutDashboard,
  Box,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  Bell,
  BarChart2,
  FileText,
  FolderOpen,
  Users,
  UserCog,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import clsx from "clsx";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "3D Mine View", icon: Box },
  { label: "Compliance", icon: ShieldCheck },
  { label: "Inspections", icon: ClipboardList },
  { label: "Violations", icon: AlertTriangle },
  { label: "Alerts", icon: Bell, badge: 5 },
  { label: "Analytics", icon: BarChart2 },
  { label: "Reports", icon: FileText },
  { label: "Documents", icon: FolderOpen },
  { label: "Contractors", icon: Users },
  { label: "Workforce", icon: UserCog },
  { label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [active, setActive] = useState("Dashboard");
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString());
    const timer = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-neutral-950 border-r border-white/10 py-4">
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ label, icon: Icon, badge }) => (
          <button
            key={label}
            onClick={() => setActive(label)}
            className={clsx(
              "flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              active === label
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-neutral-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <span className="flex items-center gap-3">
              <Icon size={16} />
              {label}
            </span>
            {badge && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 pt-4 border-t border-white/10 mt-2">
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          System Online
        </div>
        <p className="text-[10px] text-neutral-600 mt-2 tabular-nums">
          {time ?? "--:--:--"}
        </p>
      </div>
    </aside>
  );
}