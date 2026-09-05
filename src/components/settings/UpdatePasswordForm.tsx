"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { changePassword } from "@/lib/api";

export default function UpdatePasswordForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (message: string) => void;
  onCancel: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md px-4 py-1.5 text-sm font-medium"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-md px-4 py-1.5 text-sm font-medium text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
