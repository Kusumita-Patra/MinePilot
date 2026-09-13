"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Radio } from "lucide-react";
import {
  getSimulatorStatus,
  pauseSimulator,
  setSimulatorScenario,
  startSimulator,
  type SimulatorScenario,
  type SimulatorStatus,
} from "@/lib/sustainabilityApi";

const SCENARIOS: { id: SimulatorScenario; label: string }[] = [
  { id: "NORMAL_OPERATION", label: "Normal Operation" },
  { id: "HIGH_ENERGY_CONSUMPTION", label: "High Energy" },
  { id: "HIGH_WASTE_GENERATION", label: "High Waste" },
  { id: "LOW_WASTE_DIVERSION", label: "Low Waste Diversion" },
  { id: "LAND_RECLAMATION_PROGRESS", label: "Land Reclamation" },
  { id: "LAND_DISTURBANCE_INCREASE", label: "Land Disturbance" },
  { id: "ENVIRONMENTAL_ANOMALY", label: "Environmental Anomaly" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function SustainabilitySimulatorPanel() {
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    getSimulatorStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load simulator status"));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  async function toggleRunning() {
    if (!status) return;
    setBusy(true);
    try {
      const next = status.running ? await pauseSimulator() : await startSimulator();
      setStatus(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update simulator");
    } finally {
      setBusy(false);
    }
  }

  async function changeScenario(scenario: SimulatorScenario) {
    setBusy(true);
    try {
      const next = await setSimulatorScenario(scenario);
      setStatus(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update scenario");
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Radio size={16} className={status.running ? "text-blue-400 animate-pulse" : "text-neutral-500"} />
          <div>
            <p className="text-sm font-semibold text-white">Environmental Simulation</p>
            <p className="text-[11px] text-neutral-500">
              {status.running ? "RUNNING" : "PAUSED"} · Data source: SIMULATED_SENSOR · Last generated:{" "}
              {timeAgo(status.last_tick_at)}
            </p>
          </div>
        </div>
        <button
          onClick={toggleRunning}
          disabled={busy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50 ${
            status.running ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {status.running ? (
            <>
              <Pause size={13} /> Pause Simulation
            </>
          ) : (
            <>
              <Play size={13} /> Start Simulation
            </>
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div>
        <p className="text-[11px] text-neutral-500 mb-1.5">Scenario</p>
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => changeScenario(s.id)}
              disabled={busy}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium disabled:opacity-50 ${
                status.scenario === s.id
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-neutral-600 border-t border-white/10 pt-2">
        SIMULATED DATA — this demo generator has no real environmental hardware behind it. It is separate from the
        safety telemetry stream and never affects the AI risk engine.
      </p>
    </div>
  );
}
