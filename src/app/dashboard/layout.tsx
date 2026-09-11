"use client";

import RequireAuth from "@/components/RequireAuth";
import LoadingOverlay from "@/components/LoadingOverlay";
import TelemetryInspectorDrawer from "@/components/TelemetryInspectorDrawer";
import { TelemetryProvider, useTelemetry } from "@/lib/telemetryContext";
import Header from "@/app/dashboard/Header";
import Sidebar from "@/app/dashboard/Sidebar";

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { connected, usingMockData, selected, setSelected } = useTelemetry();

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      <LoadingOverlay active={!connected && !usingMockData} label="Connecting to mine network..." />
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-5 space-y-4">{children}</main>
      </div>

      <TelemetryInspectorDrawer sensor={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth allowedRoles={["mine_manager", "administrator"]}>
      <TelemetryProvider>
        <DashboardChrome>{children}</DashboardChrome>
      </TelemetryProvider>
    </RequireAuth>
  );
}
