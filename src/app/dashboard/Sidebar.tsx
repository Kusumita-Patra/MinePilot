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
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useIncidents } from "@/hooks/useIncidents";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "3D Mine View", href: "/dashboard/mine-view", icon: Box },
  { label: "Compliance", href: "/dashboard/compliance", icon: ShieldCheck },
  { label: "Inspections", href: "/dashboard/inspections", icon: ClipboardList },
  { label: "Violations", href: "/dashboard/violations", icon: AlertTriangle },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell, badge: true },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
  { label: "Reports", href: "/dashboard/reports", icon: FileText },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen },
  { label: "Contractors", href: "/dashboard/contractors", icon: Users },
  { label: "Workforce", href: "/dashboard/workforce", icon: UserCog },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [time, setTime] = useState<string | null>(null);
  const { incidents } = useIncidents();
  const openCount = incidents.filter((i) => i.status !== "SIGNED_OFF").length;

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
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-slate-950 border-r border-white/10 py-4">
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon, badge }) => {
          const active = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={clsx(
                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <span className="flex items-center gap-3">
                <Icon size={16} />
                {label}
              </span>
              {badge && openCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {openCount}
                </span>
              )}
            </Link>
          );
        })}
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
