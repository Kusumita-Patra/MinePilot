"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { updateFullName } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

export default function UpdateFullNameForm({
  currentName,
  onSuccess,
  onCancel,
}: {
  currentName: string;
  onSuccess: (message: string) => void;
  onCancel: () => void;
}) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const [fullName, setFullName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name can't be empty.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const user = await updateFullName(fullName.trim());
      updateUser({ full_name: user.full_name });
      onSuccess("Full name updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update full name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-[11px] text-neutral-400 block mb-1">Full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
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
