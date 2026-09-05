"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SensorFrame } from "../../shared/types/telemetry";
import mockData from "../../shared/mock-data/sample-telemetry-stream.json";
import { useAuthStore } from "@/lib/authStore";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/telemetry";

interface UseTelemetryWebSocketReturn {
  sensors: Record<string, SensorFrame>;
  connected: boolean;
  usingMockData: boolean;
}

export function useTelemetryWebSocket(): UseTelemetryWebSocketReturn {
  const [sensors, setSensors] = useState<Record<string, SensorFrame>>({});
  const [connected, setConnected] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mockInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const seedMockData = useCallback(() => {
    setUsingMockData(true);
    const seed: Record<string, SensorFrame> = {};
    (mockData as SensorFrame[]).forEach((f) => (seed[f.sensor_id] = f));
    setSensors(seed);

    // Simulate slight live drift every 2s so the UI isn't static
    mockInterval.current = setInterval(() => {
      setSensors((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((id) => {
          const frame = updated[id];
          const jitter = (Math.random() - 0.5) * 4;
          updated[id] = {
            ...frame,
            risk_score: Math.max(0, Math.min(100, frame.risk_score + jitter)),
            timestamp: new Date().toISOString(),
          };
        });
        return updated;
      });
    }, 2000);
  }, []);

  useEffect(() => {
    function connect() {
      const token = useAuthStore.getState().token;
      if (!token) {
        seedMockData();
        return;
      }

      try {
        const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          setUsingMockData(false);
          if (mockInterval.current) clearInterval(mockInterval.current);
        };

        ws.onmessage = (event) => {
          const frame: SensorFrame = JSON.parse(event.data);
          setSensors((prev) => ({ ...prev, [frame.sensor_id]: frame }));
        };

        ws.onclose = () => {
          setConnected(false);
          reconnectTimeout.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        seedMockData();
      }
    }

    // Try real backend first; if it's not up yet, fall back to mock data
    connect();
    const fallbackTimer = setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        seedMockData();
      }
    }, 2500);

    return () => {
      wsRef.current?.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (mockInterval.current) clearInterval(mockInterval.current);
      clearTimeout(fallbackTimer);
    };
  }, [seedMockData]);

  return { sensors, connected, usingMockData };
}