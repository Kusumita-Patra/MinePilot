"use client";

import RequireAuth from "@/components/RequireAuth";
import AdminHeader from "@/app/admin/AdminHeader";
import AdminSidebar from "@/app/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["administrator"]}>
      <div className="h-screen flex flex-col bg-slate-950 text-white">
        <AdminHeader />
        <div className="flex flex-1 overflow-hidden">
          <AdminSidebar />
          <main className="flex-1 overflow-y-auto p-5 space-y-4">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
