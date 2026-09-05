import type { AccessRole } from "../../shared/types/documents";
import { useAuthStore } from "@/lib/authStore";

// Demo-only ACL layer for the Documents/Contractors approval, audit and
// acknowledgement model. This is deliberately separate from the real
// two-role auth system (authStore's mine_manager/field_worker, enforced by
// RequireAuth) - only mine_manager ever reaches these dashboard pages today,
// so CONTRACTOR/VIEWER gating below is unreachable in practice but kept so
// the ACL model is demoable by flipping DEMO_ROLE.
const DEMO_ROLE: AccessRole = "MINE_MANAGER";

export interface CurrentUser {
  userId: string;
  name: string;
  role: AccessRole;
}

export function useCurrentUser(): CurrentUser {
  const user = useAuthStore((s) => s.user);
  return {
    userId: user?.id ?? "user-mgr-01",
    name: user?.full_name ?? "Ravi Kumar",
    role: DEMO_ROLE,
  };
}

export function canUpload(role: AccessRole): boolean {
  return role !== "VIEWER" && role !== "CONTRACTOR";
}

export function canApprove(role: AccessRole): boolean {
  return role === "ADMIN" || role === "MINE_MANAGER" || role === "SAFETY_OFFICER";
}

export function canArchive(role: AccessRole): boolean {
  return role !== "VIEWER" && role !== "CONTRACTOR";
}
