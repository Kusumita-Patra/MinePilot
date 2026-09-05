"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  widthClassName = "w-full max-w-md",
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
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(
      () => panelRef.current?.querySelector<HTMLElement>("button, input, textarea, [tabindex]")?.focus(),
      0
    );
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative bg-gray-900 border border-white/10 rounded-xl shadow-xl ${widthClassName}`}
      >
        {title && (
          <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
