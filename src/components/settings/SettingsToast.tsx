"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export interface ToastState {
  type: "success" | "error";
  message: string;
}

export default function SettingsToast({ toast }: { toast: ToastState | null }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
