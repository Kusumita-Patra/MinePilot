"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, LayoutDashboard } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";

export default function AdminHeader() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
          <p className="text-[10px] text-amber-500/80 tracking-wide">ADMIN COMMAND CENTER</p>
        </div>
      </div>

      <p className="hidden md:block text-xs text-neutral-400 font-medium tracking-wide">
        MINE CONFIGURATION &amp; SYSTEM GOVERNANCE
      </p>

      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          title="Go to Manager Dashboard"
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white border border-white/10 hover:border-white/20 rounded-md px-2.5 py-1.5 transition-colors"
        >
          <LayoutDashboard size={13} />
          <span className="hidden sm:inline">Manager Dashboard</span>
        </Link>
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <div className="w-7 h-7 rounded-full bg-amber-500/20" />
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-medium">{user?.full_name ?? "—"}</p>
            <p className="text-[10px] text-amber-500/80">Administrator</p>
          </div>
          <button onClick={handleLogout} title="Log out" className="text-neutral-500 hover:text-white ml-1">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
