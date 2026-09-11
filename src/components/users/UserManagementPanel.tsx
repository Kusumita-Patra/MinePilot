"use client";

import { useEffect, useState } from "react";
import { UserPlus, ShieldAlert } from "lucide-react";
import { getUsers, createUser, updateUserRole, updateUserStatus } from "@/lib/api";
import { useAuthStore, type AuthUser, type UserRole } from "@/lib/authStore";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

const ROLE_LABEL: Record<UserRole, string> = {
  administrator: "Administrator",
  mine_manager: "Mine Manager",
  field_worker: "Field Inspector",
};

const ROLE_BADGE: Record<UserRole, string> = {
  administrator: "bg-amber-500/15 text-amber-400",
  mine_manager: "bg-blue-500/15 text-blue-400",
  field_worker: "bg-emerald-500/15 text-emerald-400",
};

/** Shared by /admin/users (always full management) and /dashboard/workforce
 * (management controls only when the current user has been granted the
 * `users.manage` capability — see usePermissions — otherwise a plain
 * read-only roster, same as before). */
export default function UserManagementPanel({ canManage }: { canManage: boolean }) {
  const currentUser = useAuthStore((s) => s.user);
  // Only a real administrator can create/promote/touch an administrator
  // account — this mirrors a hard backend rule (services/user_service.py),
  // not just a UI preference, so a delegated `users.manage` grant (which a
  // mine_manager can hold) can never be used to mint or modify an admin.
  const isAdministrator = currentUser?.role === "administrator";
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    { type: "role"; user: AuthUser; role: UserRole } | { type: "status"; user: AuthUser; isActive: boolean } | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, []);

  const confirmAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pendingAction.type === "role") {
        await updateUserRole(pendingAction.user.id, pendingAction.role);
      } else {
        await updateUserStatus(pendingAction.user.id, pendingAction.isActive);
      }
      setPendingAction(null);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <UserPlus size={14} />
            Create User
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created At</th>
                  {canManage && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  // A non-administrator (even with users.manage granted) can
                  // never touch an administrator account's role or status —
                  // matches the backend guard exactly.
                  const isProtectedAdmin = u.role === "administrator" && !isAdministrator;
                  const rowLocked = isSelf || isProtectedAdmin;
                  return (
                    <tr key={u.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2.5 text-neutral-200">
                        {u.full_name}
                        {isSelf && <span className="text-neutral-600 text-xs ml-1.5">(you)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <Badge label={ROLE_LABEL[u.role]} className={ROLE_BADGE[u.role]} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          label={u.is_active ? "Active" : "Inactive"}
                          className={u.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-500/15 text-neutral-400"}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-neutral-500 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              disabled={rowLocked}
                              value={u.role}
                              onChange={(e) =>
                                setPendingAction({ type: "role", user: u, role: e.target.value as UserRole })
                              }
                              title={
                                isSelf
                                  ? "You cannot change your own role"
                                  : isProtectedAdmin
                                    ? "Only an administrator can change another administrator's role"
                                    : "Change role"
                              }
                              className="bg-neutral-900/70 border border-white/10 rounded-md px-2 py-1 text-xs text-white disabled:opacity-30 focus:outline-none focus:border-amber-500"
                            >
                              {isAdministrator && <option value="administrator">Administrator</option>}
                              <option value="mine_manager">Mine Manager</option>
                              <option value="field_worker">Field Inspector</option>
                            </select>
                            <button
                              disabled={rowLocked}
                              onClick={() => setPendingAction({ type: "status", user: u, isActive: !u.is_active })}
                              title={
                                isSelf
                                  ? "You cannot deactivate your own account"
                                  : isProtectedAdmin
                                    ? "Only an administrator can activate or deactivate another administrator's account"
                                    : undefined
                              }
                              className="text-xs px-2 py-1 rounded-md border border-white/10 text-neutral-300 hover:bg-white/5 disabled:opacity-30"
                            >
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canManage && (
        <>
          <CreateUserModal
            open={createOpen}
            allowAdministrator={isAdministrator}
            onClose={() => setCreateOpen(false)}
            onCreated={refresh}
          />

          <Modal open={!!pendingAction} onClose={() => setPendingAction(null)} title="Confirm action">
            {pendingAction && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-amber-400">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <p className="text-sm text-neutral-200">
                    {pendingAction.type === "role"
                      ? `Change ${pendingAction.user.full_name}'s role from ${ROLE_LABEL[pendingAction.user.role]} to ${ROLE_LABEL[pendingAction.role]}?`
                      : `${pendingAction.isActive ? "Activate" : "Deactivate"} ${pendingAction.user.full_name}?`}
                  </p>
                </div>
                {actionError && <p className="text-xs text-red-400">{actionError}</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setPendingAction(null)}
                    className="px-3 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAction}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white"
                  >
                    {busy ? "Applying…" : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}

function CreateUserModal({
  open,
  allowAdministrator,
  onClose,
  onCreated,
}: {
  open: boolean;
  allowAdministrator: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("field_worker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setFullName("");
    setPassword("");
    setRole("field_worker");
    setError(null);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await createUser({ email, password, full_name: fullName, role });
      reset();
      onClose();
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create user"
    >
      <div className="space-y-3">
        <label className="block text-xs text-neutral-400">
          Full name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="block text-xs text-neutral-400">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="block text-xs text-neutral-400">
          Temporary password (min 8 characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="block text-xs text-neutral-400">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          >
            <option value="field_worker">Field Inspector</option>
            <option value="mine_manager">Mine Manager</option>
            {allowAdministrator && <option value="administrator">Administrator</option>}
          </select>
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          disabled={!email || !fullName || password.length < 8 || busy}
          onClick={handleCreate}
          className="w-full px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
      </div>
    </Modal>
  );
}
