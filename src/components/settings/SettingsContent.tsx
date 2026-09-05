"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { checkBackendHealth } from "@/lib/api";
import PersonalInfoSection from "./PersonalInfoSection";

export default function SettingsContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    checkBackendHealth().then(setBackendUp);
  }, []);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="space-y-4">
      <PersonalInfoSection user={user} />

      <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide">SYSTEM STATUS</p>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              backendUp === null ? "bg-neutral-500" : backendUp ? "bg-emerald-400" : "bg-red-500"
            }`}
          />
          <span>
            Backend:{" "}
            {backendUp === null ? "Checking…" : backendUp ? "Connected" : "Unreachable"}
          </span>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="bg-red-600 hover:bg-red-500 rounded-md px-4 py-2 text-sm font-medium"
      >
        Log out
      </button>
    </div>
  );
}
