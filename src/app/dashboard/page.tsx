"use client";

import { useTelemetry } from "@/lib/telemetryContext";
import KpiCards from "@/app/dashboard/KpiCards";
import MineDigitalTwinContainer from "@/app/dashboard/MineDigitalTwinContainer";
import AiRiskAnalysis from "@/app/dashboard/AiRiskAnalysis";
import RecentAlerts from "@/app/dashboard/RecentAlerts";
import AnalyticsSection from "@/app/dashboard/AnalyticsSection";
import QuickActions from "@/app/dashboard/QuickActions";
import IncidentSignOff from "@/app/dashboard/IncidentSignOff";
import MineDigitalTwin from "@/components/digital-twin";

export default function DashboardPage() {
  const { sensors, selected, setSelected } = useTelemetry();

  const sensorList = Object.values(sensors);
  const avgRisk = sensorList.length
    ? Math.round(sensorList.reduce((a, s) => a + s.risk_score, 0) / sensorList.length)
    : 70;

  return (
    <>
      <KpiCards />

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <MineDigitalTwinContainer>
            <MineDigitalTwin
              sensors={sensorList}
              selectedSensor={selected}
              onSelectSensor={setSelected}
            />
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
    </>
  );
}
