"use client";

import type { KeyboardEvent } from "react";
import clsx from "clsx";

export interface TabItem {
  id: string;
  label: string;
}

export default function Tabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = tabs.findIndex((t) => t.id === activeId);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onChange(tabs[(idx + 1) % tabs.length].id);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(tabs[(idx - 1 + tabs.length) % tabs.length].id);
    }
  }

  return (
    <div role="tablist" onKeyDown={handleKeyDown} className="flex gap-1 border-b border-white/10 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeId}
          tabIndex={tab.id === activeId ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
            tab.id === activeId
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-neutral-500 hover:text-neutral-300"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
