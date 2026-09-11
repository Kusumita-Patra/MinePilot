"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Maximize2, LogOut, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { useIncidents } from "@/hooks/useIncidents";

const ROLE_LABEL: Record<string, string> = {
  administrator: "Administrator",
  mine_manager: "Mine Manager",
  field_worker: "Field Inspector",
};

export default function Header() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { incidents } = useIncidents();
  const openCount = incidents.filter((i) => i.status !== "SIGNED_OFF").length;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="h-16 bg-slate-950 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <Image src="/Logo.png" alt="MinePilot" width={190} height={90} className="h-15 w-15" priority />
        <div className="leading-tight">
          <p className="font-bold text-sm tracking-wide">MINEPILOT</p>
          <p className="text-[10px] text-neutral-500 tracking-wide">COMMAND CENTER</p>
        </div>
      </div>

      <p className="hidden md:block text-xs text-neutral-400 font-medium tracking-wide">
        AI-BASED SMART GOVERNANCE AND COMPLIANCE MONITORING SYSTEM FOR COAL MINES
      </p>

      <div className="flex items-center gap-4">
        {user?.role === "administrator" && (
          <Link
            href="/admin"
            title="Admin Command Center"
            className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-300/50 rounded-md px-2.5 py-1.5 transition-colors"
          >
            <ShieldCheck size={13} />
            <span className="hidden sm:inline">Admin Console</span>
          </Link>
        )}
        <button
          onClick={() => router.push("/dashboard/alerts")}
          title="View alerts"
          className="relative text-neutral-400 hover:text-white"
        >
          <Bell size={18} />
          {openCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
              {openCount}
            </span>
          )}
        </button>
        <button className="text-neutral-400 hover:text-white">
          <Maximize2 size={16} />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <div className="w-7 h-7 rounded-full bg-neutral-700" />
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-medium">{user?.full_name ?? "—"}</p>
            <p className="text-[10px] text-neutral-500">
              {user ? (ROLE_LABEL[user.role] ?? user.role) : ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="text-neutral-500 hover:text-white ml-1"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
