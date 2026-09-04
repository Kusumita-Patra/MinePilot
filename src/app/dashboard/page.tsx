"use client";

import { useState } from "react";
import { useTelemetryWebSocket } from "@/hooks/useTelemetryWebSocket";
import TelemetryInspectorDrawer from "@/components/TelemetryInspectorDrawer";
import Header from "@/app/dashboard/Header";
import Sidebar from "@/app/dashboard/Sidebar";
import KpiCards from "@/app/dashboard/KpiCards";
import MineDigitalTwinContainer from "@/app/dashboard/MineDigitalTwinContainer";
import AiRiskAnalysis from "@/app/dashboard/AiRiskAnalysis";
import RecentAlerts from "@/app/dashboard/RecentAlerts";
import AnalyticsSection from "@/app/dashboard/AnalyticsSection";
import QuickActions from "@/app/dashboard/QuickActions";
import IncidentSignOff from "@/app/dashboard/IncidentSignOff";
import type { SensorFrame } from "../../../shared/types/telemetry";

export default function DashboardPage() {
  const { sensors } = useTelemetryWebSocket();
  const [selected, setSelected] = useState<SensorFrame | null>(null);

  const sensorList = Object.values(sensors);
  const avgRisk = sensorList.length
    ? Math.round(sensorList.reduce((a, s) => a + s.risk_score, 0) / sensorList.length)
    : 70;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-5 space-y-4">
          <KpiCards />

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <MineDigitalTwinContainer>
                <div
                  className="text-center px-6 cursor-pointer"
                  onClick={() => sensorList[0] && setSelected(sensorList[0])}
                >
                  <div className="text-5xl mb-3">🛰️</div>
                  <p className="text-neutral-400 font-medium">3D Digital Twin Viewport</p>
                  <p className="text-neutral-600 text-sm mt-1">
                    Waiting for Team 1&apos;s &lt;MineDigitalTwin /&gt; component
                  </p>
                </div>
              </MineDigitalTwinContainer>
            </div>

            <AiRiskAnalysis riskScore={avgRisk} />
          </div>

          <AnalyticsSection />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentAlerts />
            <QuickActions />
            <IncidentSignOff />
          </div>
        </main>
      </div>

      <TelemetryInspectorDrawer sensor={selected} onClose={() => setSelected(null)} />
    </div>
  );
}