"use client";

import { useUsers } from "@/hooks/useUsers";

const ROLE_LABEL: Record<string, string> = {
  mine_manager: "Mine Manager",
  field_worker: "Field Worker",
};

export default function WorkforcePage() {
  const { users, loading, error } = useUsers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Workforce</h1>
        <span className="text-xs text-neutral-500">{users.length} registered</span>
      </div>

      {error && <p className="text-xs text-amber-400">{error}</p>}

      {loading && users.length === 0 ? (
        <p className="text-sm text-neutral-500">Loading workforce…</p>
      ) : (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3 text-neutral-400">{u.email}</td>
                    <td className="px-4 py-3 text-neutral-400">{ROLE_LABEL[u.role] ?? u.role}</td>
                    <td className="px-4 py-3 text-emerald-400 text-[11px]">Active</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
