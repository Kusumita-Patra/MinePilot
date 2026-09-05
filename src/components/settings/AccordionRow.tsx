"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function AccordionRow({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/5 transition-colors"
      >
        <span>{label}</span>
        <ChevronDown
          size={16}
          className={`text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-white/10">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
