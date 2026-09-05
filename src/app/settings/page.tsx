"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/authStore";
import { checkBackendHealth, changePassword } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";

const ROLE_LABEL: Record<string, string> = {
  mine_manager: "Mine Manager",
  field_worker: "Field Worker",
};

const ROLE_HOME: Record<string, string> = {
  mine_manager: "/dashboard",
  field_worker: "/field",
};

function SettingsView() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    checkBackendHealth().then(setBackendUp);
  }, []);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }

    setPwBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPwBusy(false);
    }
  }

  const backHref = user ? (ROLE_HOME[user.role] ?? "/") : "/";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 pt-2">
        <Link href={backHref} className="text-xs text-blue-400 hover:underline">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Settings</h1>
        <div className="w-10" />
      </div>

      <div className="space-y-4">
        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide">PROFILE</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-neutral-500">Full name</p>
              <p>{user?.full_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500">Email</p>
              <p>{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500">Role</p>
              <p>{user ? (ROLE_LABEL[user.role] ?? user.role) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500">User ID</p>
              <p className="truncate text-neutral-400 text-xs">{user?.id ?? "—"}</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleChangePassword}
          className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-neutral-300 tracking-wide">CHANGE PASSWORD</p>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Current password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md bg-black/30 border border-white/10 p-2 text-sm"
            />
          </div>

          {pwError && <p className="text-xs text-red-400">{pwError}</p>}
          {pwSuccess && <p className="text-xs text-emerald-400">Password updated successfully.</p>}

          <button
            type="submit"
            disabled={pwBusy}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium"
          >
            {pwBusy ? "Updating…" : "Update password"}
          </button>
        </form>

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
