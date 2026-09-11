"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import type { AuthUser } from "@/lib/authStore";
import AccordionRow from "./AccordionRow";
import UpdateFullNameForm from "./UpdateFullNameForm";
import UpdateEmailForm from "./UpdateEmailForm";
import UpdatePasswordForm from "./UpdatePasswordForm";
import SettingsToast, { type ToastState } from "./SettingsToast";

const ROLE_LABEL: Record<string, string> = {
  administrator: "Administrator",
  mine_manager: "Mine Manager",
  field_worker: "Field Inspector",
};

type OpenField = "name" | "email" | "password" | null;

export default function PersonalInfoSection({ user }: { user: AuthUser | null }) {
  const [expanded, setExpanded] = useState(false);
  const [openField, setOpenField] = useState<OpenField>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleSuccess(message: string) {
    setToast({ type: "success", message });
    setOpenField(null);
  }

  function toggleField(field: OpenField) {
    setOpenField((prev) => (prev === field ? null : field));
  }

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="text-left">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide">
            UPDATE PERSONAL INFORMATION
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
            <span className="text-neutral-200">{user?.full_name ?? "—"}</span>
            <span className="text-neutral-500">{user?.email ?? "—"}</span>
            <span className="text-neutral-500">
              {user ? (ROLE_LABEL[user.role] ?? user.role) : "—"}
            </span>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-neutral-500 transition-transform duration-200 shrink-0 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <motion.div
        initial={false}
        animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          <SettingsToast toast={toast} />

          <div className="grid grid-cols-2 gap-3 text-sm bg-black/20 rounded-lg p-3">
            <div>
              <p className="text-[11px] text-neutral-500">Role</p>
              <p>{user ? (ROLE_LABEL[user.role] ?? user.role) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500">User ID</p>
              <p className="truncate text-neutral-400 text-xs">{user?.id ?? "—"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <AccordionRow
              label="Update Full Name"
              open={openField === "name"}
              onToggle={() => toggleField("name")}
            >
              <UpdateFullNameForm
                currentName={user?.full_name ?? ""}
                onSuccess={handleSuccess}
                onCancel={() => setOpenField(null)}
              />
            </AccordionRow>

            <AccordionRow
              label="Update Email"
              open={openField === "email"}
              onToggle={() => toggleField("email")}
            >
              <UpdateEmailForm
                currentEmail={user?.email ?? ""}
                onSuccess={handleSuccess}
                onCancel={() => setOpenField(null)}
              />
            </AccordionRow>

            <AccordionRow
              label="Update Password"
              open={openField === "password"}
              onToggle={() => toggleField("password")}
            >
              <UpdatePasswordForm
                onSuccess={handleSuccess}
                onCancel={() => setOpenField(null)}
              />
            </AccordionRow>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
