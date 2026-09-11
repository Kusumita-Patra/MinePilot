"use client";

import {
  LayoutDashboard,
  Box,
  MapPinned,
  Layers,
  Radio,
  Users,
  KeySquare,
  ShieldCheck,
  Bell,
  ScrollText,
  Activity,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_GROUPS: {
  heading: string | null;
  items: { label: string; href: string; icon: typeof LayoutDashboard }[];
}[] = [
  { heading: null, items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }] },
  {
    heading: "Mine Configuration",
    items: [
      { label: "3D Mine View", href: "/admin/mine/view", icon: Box },
      { label: "Blueprint", href: "/admin/mine/blueprint", icon: MapPinned },
      { label: "Levels & Zones", href: "/admin/mine/zones", icon: Layers },
      { label: "Sensors", href: "/admin/mine/sensors", icon: Radio },
    ],
  },
  {
    heading: "Users & Access",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Roles & Permissions", href: "/admin/roles", icon: KeySquare },
    ],
  },
  {
    heading: "Compliance Governance",
    items: [{ label: "Compliance Rules", href: "/admin/compliance", icon: ShieldCheck }],
  },
  {
    heading: "Alert Configuration",
    items: [{ label: "Alert Rules", href: "/admin/alerts", icon: Bell }],
  },
  { heading: null, items: [{ label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText }] },
  { heading: null, items: [{ label: "System Health", href: "/admin/system-health", icon: Activity }] },
  { heading: null, items: [{ label: "Settings", href: "/admin/settings", icon: Settings }] },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-slate-950 border-r border-white/10 py-4 overflow-y-auto">
      <nav className="flex-1 flex flex-col gap-4 px-3">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="space-y-1">
            {group.heading && (
              <p className="px-3 text-[10px] font-semibold tracking-wider text-neutral-600 uppercase mt-1">
                {group.heading}
              </p>
            )}
            {group.items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-amber-500/15 text-amber-400 border border-amber-400/30"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 pt-4 border-t border-white/10 mt-2">
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <ShieldCheck size={13} />
          Administrator
        </div>
      </div>
    </aside>
  );
}
