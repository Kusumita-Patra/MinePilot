"use client";

import {
  LayoutDashboard,
  Box,
  MapPinned,
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
  Gavel,
  ScrollText,
  Activity,
  Leaf,
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useIncidents } from "@/hooks/useIncidents";
import { useDocuments } from "@/hooks/useDocuments";
import { useContractors } from "@/hooks/useContractors";
import { usePermissions } from "@/hooks/usePermissions";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "3D Mine View", href: "/dashboard/mine-view", icon: Box },
  { label: "Blueprint", href: "/dashboard/blueprint", icon: MapPinned },
  { label: "Compliance", href: "/dashboard/compliance", icon: ShieldCheck },
  { label: "Inspections", href: "/dashboard/inspections", icon: ClipboardList },
  { label: "Violations", href: "/dashboard/violations", icon: AlertTriangle },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell, badge: "incidents" as const },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
  { label: "Reports", href: "/dashboard/reports", icon: FileText },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen, badge: "documents" as const },
  { label: "Contractors", href: "/dashboard/contractors", icon: Users, badge: "contractors" as const },
  { label: "Sustainability", href: "/dashboard/sustainability", icon: Leaf },
  { label: "Workforce", href: "/dashboard/workforce", icon: UserCog },
];

// Only appear in the sidebar at all when an administrator has granted the
// matching capability via /admin/roles (see usePermissions) — the item
// itself is added/removed, with no separate section or label calling it out
// as "granted"; it should look exactly like any other nav item.
const GRANTABLE_NAV_ITEMS = [
  { label: "Governance", href: "/dashboard/governance", icon: Gavel, capability: "governance.view", badge: undefined },
  { label: "Audit Logs", href: "/dashboard/audit-logs", icon: ScrollText, capability: "audit_logs.view", badge: undefined },
  { label: "System Health", href: "/dashboard/system-health", icon: Activity, capability: "system_health.view", badge: undefined },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [time, setTime] = useState<string | null>(null);
  const { incidents } = useIncidents();
  const { stats: documentStats } = useDocuments();
  const { stats: contractorStats } = useContractors();
  const { can } = usePermissions();
  const openCount = incidents.filter((i) => i.status !== "SIGNED_OFF").length;
  const badgeCounts: Record<string, number> = {
    incidents: openCount,
    documents: documentStats.expired + documentStats.missing,
    contractors: contractorStats.contractorsWithGaps,
  };
  const visibleNavItems = [...NAV_ITEMS, ...GRANTABLE_NAV_ITEMS.filter((item) => can(item.capability))];

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
        {visibleNavItems.map(({ label, href, icon: Icon, badge }) => {
          const active = pathname === href;
          const count = badge ? badgeCounts[badge] : 0;
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
              {badge && count > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </Link>
          );
        })}

        <Link
          href="/dashboard/settings"
          className={clsx(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mt-1",
            pathname === "/dashboard/settings"
              ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
              : "text-neutral-400 hover:bg-white/5 hover:text-white"
          )}
        >
          <Settings size={16} />
          Settings
        </Link>
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
