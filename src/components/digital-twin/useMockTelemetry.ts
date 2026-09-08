"use client";

import { useEffect, useRef, useState } from "react";

import { classifyRiskLevel } from "./sensorUtils";
import type { SensorData } from "./types";

/**
 * Stands in for the telemetry simulator until the socket is wired up. It drifts
 * a couple of sensors per tick, so risk levels cross the 40 and 75 thresholds
 * on their own and the NORMAL -> WARNING -> CRITICAL transitions can be watched
 * without a backend.
 *
 * Untouched sensors keep their object identity, which mirrors how
 * useTelemetrySocket behaves — the same memoization applies in both cases.
 */

export interface MockTelemetryOptions {
  intervalMs?: number;
  /** How many sensors change on each tick. */
  sensorsPerTick?: number;
  /** Entries kept in each sensor's historicalData buffer. */
  historyLimit?: number;
  enabled?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function driftSensor(sensor: SensorData, historyLimit: number): SensorData {
  // Slight downward bias so sensors recover instead of all pinning at CRITICAL.
  const riskScore = clamp(sensor.risk_score + (Math.random() - 0.45) * 22, 2, 99);
  const riskLevel = classifyRiskLevel(riskScore);
  const severity = riskScore / 100;
  const previous = sensor.telemetry;
  const timestamp = new Date().toISOString();

  const history = [
    ...(sensor.historicalData ?? []),
    { timestamp, risk_score: round(riskScore, 1) },
  ].slice(-historyLimit);

  return {
    ...sensor,
    risk_score: round(riskScore, 1),
    risk_level: riskLevel,
    telemetry: {
      ch4_pct: round(clamp(previous.ch4_pct + (Math.random() - 0.4) * 0.3, 0, 5), 2),
      co_ppm: round(clamp(previous.co_ppm + (Math.random() - 0.45) * 9, 0, 200), 1),
      displacement_mm: round(clamp(previous.displacement_mm + severity * 0.2, 0, 40), 2),
      temp_c: round(clamp(previous.temp_c + (Math.random() - 0.5) * 1.4, 10, 60), 1),
      dust_pm10: round(clamp(previous.dust_pm10 + (Math.random() - 0.45) * 1.2, 0, 30), 1),
    },
    timestamp,
    historicalData: history,
  };
}

export function useMockTelemetry(
  seed: SensorData[],
  {
    intervalMs = 1500,
    sensorsPerTick = 2,
    historyLimit = 60,
    enabled = true,
  }: MockTelemetryOptions = {},
): SensorData[] {
  const [sensors, setSensors] = useState<SensorData[]>(seed);

  const optionsRef = useRef({ sensorsPerTick, historyLimit });
  optionsRef.current = { sensorsPerTick, historyLimit };

  useEffect(() => {
    setSensors(seed);
  }, [seed]);

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      setSensors((current) => {
        if (current.length === 0) return current;

        const { sensorsPerTick: count, historyLimit: limit } = optionsRef.current;
        const targets = new Set<number>();
        for (let i = 0; i < Math.min(count, current.length); i++) {
          targets.add(Math.floor(Math.random() * current.length));
        }

        return current.map((sensor, index) =>
          targets.has(index) ? driftSensor(sensor, limit) : sensor,
        );
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs]);

  return sensors;
}
