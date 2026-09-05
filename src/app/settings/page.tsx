"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/authStore";
import RequireAuth from "@/components/RequireAuth";
import SettingsContent from "@/components/settings/SettingsContent";

function SettingsView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // Mine managers get Settings inside the dashboard shell (sidebar + header),
  // same as every other section - this standalone page is only for field
  // workers, who have no sidebar at all.
  useEffect(() => {
    if (user?.role === "mine_manager") router.replace("/dashboard/settings");
  }, [user, router]);

  if (user?.role === "mine_manager") return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 pt-2">
        <Link href="/field" className="text-xs text-blue-400 hover:underline">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Settings</h1>
        <div className="w-10" />
      </div>

      <SettingsContent />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth allowedRoles={["mine_manager", "field_worker"]}>
      <SettingsView />
    </RequireAuth>
  );
}
