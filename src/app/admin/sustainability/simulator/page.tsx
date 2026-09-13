"use client";

import SustainabilitySimulatorPanel from "@/components/sustainability/SustainabilitySimulatorPanel";

export default function AdminSustainabilitySimulatorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Sustainability Data Simulator</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Controls the automatic simulated environmental data pipeline (Energy/Waste/Land) used for the hackathon
          demo. All generated data is clearly labeled SIMULATED_SENSOR and is entirely separate from the safety
          telemetry stream and the AI risk engine.
        </p>
      </div>
      <SustainabilitySimulatorPanel />
    </div>
  );
}
