"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { classifyRiskLevel, hasSensorChanged, isRiskLevel } from "./sensorUtils";
import type { SensorData } from "./types";

/**
 * Real-time transport for /ws/telemetry. Deliberately isolated from every
 * rendering component: <SensorMarkers /> only ever sees a SensorData[] prop, so
 * it works identically with a socket, with mock data, or with replayed history.
 *
 *   const { sensors, status } = useTelemetrySocket({
 *     url: "ws://localhost:8000/ws/telemetry",
 *     initialSensors: mockSensors,
 *   });
 */

export type TelemetryStatus = "idle" | "connecting" | "open" | "closed" | "error";

export interface TelemetrySocketOptions {
  url: string;
  /** Seed list, so the scene has something to draw before the first message. */
  initialSensors?: SensorData[];
  /**
   * Messages are buffered and applied on this cadence. A simulator pushing
   * hundreds of updates per second then costs ~10 React renders per second
   * instead of hundreds.
   */
  flushIntervalMs?: number;
  reconnectDelayMs?: number;
  enabled?: boolean;
}

export interface TelemetrySocketResult {
  sensors: SensorData[];
  status: TelemetryStatus;
  lastMessageAt: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validates and normalizes one raw payload. Returns null if unusable. */
export function normalizeSensorPayload(raw: unknown): SensorData | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.sensor_id !== "string" || typeof raw.sector_id !== "string") return null;

  const coordinates = raw.coordinates;
  const telemetry = raw.telemetry;
  if (!isRecord(coordinates) || !isRecord(telemetry)) return null;

  const riskScore = typeof raw.risk_score === "number" ? raw.risk_score : 0;

  return {
    sensor_id: raw.sensor_id,
    sector_id: raw.sector_id,
    coordinates: {
      x: Number(coordinates.x) || 0,
      y: Number(coordinates.y) || 0,
      z: Number(coordinates.z) || 0,
    },
    telemetry: {
      ch4_pct: Number(telemetry.ch4_pct) || 0,
      co_ppm: Number(telemetry.co_ppm) || 0,
      displacement_mm: Number(telemetry.displacement_mm) || 0,
      temp_c: Number(telemetry.temp_c) || 0,
      dust_pm10: Number(telemetry.dust_pm10) || 0,
    },
    risk_score: riskScore,
    // The backend's classification is authoritative; the score is only used
    // when a payload arrives without a usable level.
    risk_level: isRiskLevel(raw.risk_level) ? raw.risk_level : classifyRiskLevel(riskScore),
    timestamp: typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
    historicalData: Array.isArray(raw.historicalData) ? raw.historicalData : undefined,
  };
}

/** Accepts a single sensor, an array, or an envelope such as { data: [...] }. */
function extractPayloads(message: unknown): SensorData[] {
  if (Array.isArray(message)) {
    return message.map(normalizeSensorPayload).filter((s): s is SensorData => s !== null);
  }

  if (isRecord(message) && (Array.isArray(message.data) || Array.isArray(message.sensors))) {
    const list = (message.data ?? message.sensors) as unknown[];
    return list.map(normalizeSensorPayload).filter((s): s is SensorData => s !== null);
  }

  const single = normalizeSensorPayload(message);
  return single ? [single] : [];
}

export function useTelemetrySocket({
  url,
  initialSensors,
  flushIntervalMs = 100,
  reconnectDelayMs = 2000,
  enabled = true,
}: TelemetrySocketOptions): TelemetrySocketResult {
  const registryRef = useRef<Map<string, SensorData>>(
    new Map((initialSensors ?? []).map((sensor) => [sensor.sensor_id, sensor])),
  );
  const pendingRef = useRef<Map<string, SensorData>>(new Map());

  const [sensors, setSensors] = useState<SensorData[]>(() => initialSensors ?? []);
  const [status, setStatus] = useState<TelemetryStatus>("idle");
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    if (pending.size === 0) return;

    const registry = registryRef.current;
    let changed = false;

    for (const [id, incoming] of pending) {
      const previous = registry.get(id);
      // Preserving identity for untouched sensors is what lets React.memo skip
      // their markers entirely on a partial update.
      if (previous && !hasSensorChanged(previous, incoming)) continue;
      registry.set(id, incoming);
      changed = true;
    }

    pending.clear();
    if (changed) setSensors(Array.from(registry.values()));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(flush, flushIntervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, flush, flushIntervalMs]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let socket: WebSocket | null = null;
    let reconnectTimer = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      setStatus("connecting");
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (!disposed) setStatus("open");
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed: unknown = JSON.parse(event.data);
          for (const sensor of extractPayloads(parsed)) {
            pendingRef.current.set(sensor.sensor_id, sensor);
          }
          setLastMessageAt(Date.now());
        } catch {
          // A malformed frame must never take the visualization down.
        }
      };

      socket.onerror = () => {
        if (!disposed) setStatus("error");
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus("closed");
        reconnectTimer = window.setTimeout(connect, reconnectDelayMs);
      };
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [url, enabled, reconnectDelayMs]);

  return { sensors, status, lastMessageAt };
}
