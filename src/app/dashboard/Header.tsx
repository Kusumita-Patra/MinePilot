import { Bell, Maximize2, ChevronDown } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-neutral-950 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-sm font-bold">
          SM
        </div>
        <div className="leading-tight">
          <p className="font-bold text-sm tracking-wide">SMARTMINE</p>
          <p className="text-[10px] text-neutral-500 tracking-wide">COMMAND CENTER</p>
        </div>
      </div>

      <p className="hidden md:block text-xs text-neutral-400 font-medium tracking-wide">
        AI-BASED SMART GOVERNANCE AND COMPLIANCE MONITORING SYSTEM FOR COAL MINES
      </p>

      <div className="flex items-center gap-4">
        <button className="relative text-neutral-400 hover:text-white">
          <Bell size={18} />
          <span className="absolute -top-1 -right-1 bg-red-500 text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            5
          </span>
        </button>
        <button className="text-neutral-400 hover:text-white">
          <Maximize2 size={16} />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          <div className="w-7 h-7 rounded-full bg-neutral-700" />
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-medium">Mine Officer</p>
            <p className="text-[10px] text-neutral-500">Raniganj Coalfield</p>
          </div>
          <ChevronDown size={14} className="text-neutral-500" />
        </div>
      </div>
    </header>
  );
}