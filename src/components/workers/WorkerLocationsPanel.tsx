"use client";

import { useEffect, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import MineDigitalTwinContainer from "@/components/digital-twin/MineDigitalTwinContainer";
import MineDigitalTwin from "@/components/digital-twin";
import { DEFAULT_CAMERA_PRESET } from "@/components/digital-twin/sectors";
import type { CameraPresetId } from "@/components/digital-twin";
import { WorkerLocationOverlay } from "@/components/digital-twin/workers/WorkerLocationOverlay";
import { formatSectorId } from "@/lib/format";
import { getWorkerLocations, type WorkerLocation } from "@/lib/workerLocationsApi";

const REFRESH_MS = 15000;

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function WorkerLocationsPanel() {
  const [locations, setLocations] = useState<WorkerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>(DEFAULT_CAMERA_PRESET);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getWorkerLocations()
        .then((data) => {
          if (cancelled) return;
          setLocations(data);
          setError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "Failed to load worker locations");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const activeCount = locations.filter((l) => l.is_active).length;

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-400">
          Every field worker&apos;s current position inside the mine — continuously simulated (no real underground
          personnel-tracking hardware exists in this project), refreshed every {REFRESH_MS / 1000}s.
        </p>
        <div className="flex items-center gap-3 text-xs text-neutral-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> {activeCount} active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neutral-500" /> {locations.length - activeCount} idle
          </span>
        </div>
      </div>

      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No field workers being tracked yet"
          description="Positions appear here once the worker geotracking simulator places the active workforce on the mine graph."
        />
      ) : (
        <>
          <MineDigitalTwinContainer activePreset={cameraPreset} onSelectPreset={setCameraPreset}>
            <MineDigitalTwin cameraPreset={cameraPreset} onCameraPresetChange={setCameraPreset}>
              <WorkerLocationOverlay locations={locations} onSelectWorker={setSelectedWorkerId} />
            </MineDigitalTwin>
          </MineDigitalTwinContainer>

          <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Worker</th>
                  <th className="px-4 py-2.5 font-medium">Sector</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Last Updated</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr
                    key={loc.worker_id}
                    className={`border-b border-white/5 last:border-0 cursor-pointer transition-colors ${
                      selectedWorkerId === loc.worker_id ? "bg-sky-500/10" : "hover:bg-white/5"
                    }`}
                    onClick={() => setSelectedWorkerId(loc.worker_id)}
                  >
                    <td className="px-4 py-2.5 text-neutral-200 font-medium">{loc.worker_name}</td>
                    <td className="px-4 py-2.5 text-neutral-400">{loc.sector_id ? formatSectorId(loc.sector_id) : "—"}</td>
                    <td className="px-4 py-2.5 text-neutral-300">{loc.node_label ?? "—"}</td>
                    <td className="px-4 py-2.5 text-neutral-500 tabular-nums">{timeAgo(loc.last_moved_at)}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        icon={Radio}
                        label={loc.is_active ? "Active" : "Idle"}
                        className={loc.is_active ? "bg-sky-500/15 text-sky-400" : "bg-neutral-700/40 text-neutral-400"}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge label={loc.source_type} className="bg-purple-500/15 text-purple-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
