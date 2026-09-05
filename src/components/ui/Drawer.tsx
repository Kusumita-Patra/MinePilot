"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Drawer({
  open,
  onClose,
  title,
  children,
  widthClassName = "w-full max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  widthClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(
      () => panelRef.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus(),
      0
    );
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative h-full bg-gray-950 border-l border-white/10 shadow-xl overflow-y-auto ${widthClassName}`}
      >
        <div className="sticky top-0 bg-gray-950 border-b border-white/10 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
