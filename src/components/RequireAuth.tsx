"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, type UserRole } from "@/lib/authStore";

const ROLE_HOME: Record<UserRole, string> = {
  mine_manager: "/dashboard",
  field_worker: "/field",
};

export default function RequireAuth({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;

    if (!token || !user) {
      router.replace("/login");
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [isHydrated, token, user, allowedRoles, router]);

  if (!isHydrated || !token || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-neutral-400 text-sm">
        Checking session…
      </div>
    );
  }

  return <>{children}</>;
}
