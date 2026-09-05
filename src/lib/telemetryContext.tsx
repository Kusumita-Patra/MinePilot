"use client";

import { createContext, useContext, useState } from "react";
import { useTelemetryWebSocket } from "@/hooks/useTelemetryWebSocket";
import type { SensorFrame } from "../../shared/types/telemetry";

interface TelemetryContextValue {
  sensors: Record<string, SensorFrame>;
  connected: boolean;
  usingMockData: boolean;
  selected: SensorFrame | null;
  setSelected: (sensor: SensorFrame | null) => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { sensors, connected, usingMockData } = useTelemetryWebSocket();
  const [selected, setSelected] = useState<SensorFrame | null>(null);

  return (
    <TelemetryContext.Provider value={{ sensors, connected, usingMockData, selected, setSelected }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error("useTelemetry must be used within a TelemetryProvider");
  return ctx;
}
