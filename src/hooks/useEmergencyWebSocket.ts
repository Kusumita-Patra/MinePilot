"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { EmergencyWsMessage } from "../../shared/types/emergency";
import { useAuthStore } from "@/lib/authStore";
import { API_URL } from "@/lib/api";

const WS_URL = process.env.NEXT_PUBLIC_EMERGENCY_WS_URL ?? `${API_URL.replace(/^http/, "ws")}/ws/emergency`;

/** Separate from useTelemetryWebSocket — a different backend broadcast
 * channel (emergency_broadcast_service), a different message envelope, and
 * no mock-data fallback (an emergency feed silently showing fabricated data
 * would be actively dangerous, unlike telemetry's cosmetic mock stream). */
export function useEmergencyWebSocket(onMessage: (msg: EmergencyWsMessage) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg: EmergencyWsMessage = JSON.parse(event.data);
          onMessageRef.current(msg);
        } catch {
          // ignore malformed frame
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    } catch {
      reconnectTimeout.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return { connected };
}
