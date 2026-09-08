"use client";

import { useState } from "react";
import AnalyticsSection from "@/app/dashboard/AnalyticsSection";
import SectorRiskHistory from "@/components/analytics/SectorRiskHistory";
import FutureRiskPrediction from "@/components/analytics/FutureRiskPrediction";
import { useRiskRanking } from "@/hooks/useRiskRanking";

export default function AnalyticsPage() {
  const { data: ranking } = useRiskRanking();
  // Derived, not synchronized via an effect: defaults to the top-ranked
  // sector until the user picks one explicitly.
  const [userSelected, setUserSelected] = useState<string | null>(null);
  const sectorId = userSelected ?? ranking[0]?.sector_id ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Analytics</h1>

      <AnalyticsSection />

      <SectorRiskHistory ranking={ranking} sectorId={sectorId} onSectorChange={setUserSelected} />

      <FutureRiskPrediction sectorId={sectorId} />
    </div>
  );
}
