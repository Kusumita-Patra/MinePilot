"use client";

// Administrator's own copy of the 3D Mine View — same live twin the manager
// dashboard shows (dashboard/mine-view/page.tsx), reusing the exact same
// MineViewPanel. The admin route tree has no TelemetryProvider of its own
// (only dashboard/layout.tsx mounts one), so this page wraps its own — scoped
// to just this page rather than the whole admin shell, so the WebSocket only
// connects while an administrator is actually looking at this view.
import { TelemetryProvider } from "@/lib/telemetryContext";
import MineViewPanel from "@/components/digital-twin/MineViewPanel";

export default function AdminMineViewPage() {
  return (
    <TelemetryProvider>
      <MineViewPanel />
    </TelemetryProvider>
  );
}
