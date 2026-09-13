"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Radio, X } from "lucide-react";
import { createSensor, getSensors, type SensorConfig, type SensorType } from "@/lib/sensorsApi";
import type { BlueprintSectorId } from "@/lib/blueprintApi";

/** Administrator-only sensor placement — deliberately a separate component
 * from BlueprintEditor.tsx's TracerPanel (which mine_manager can also render
 * on their own dashboard when granted `blueprint.write`). Sensor mutations
 * are fixed administrator-only regardless of that grant, so this only ever
 * mounts on /admin/mine/blueprint, never on the manager-facing page. */

const SECTOR_OPTIONS: { id: BlueprintSectorId; label: string; color: string }[] = [
  { id: "sector_north_wall", label: "North Section", color: "#38d6ff" },
  { id: "sector_shaft_b", label: "Deep Shaft B", color: "#a855f7" },
  { id: "sector_conveyor_3", label: "Surface Conveyor", color: "#f97316" },
  { id: "sector_south_face", label: "Main Tunnel Network", color: "#22c55e" },
];

const SENSOR_TYPES: SensorType[] = [
  "METHANE",
  "CARBON_MONOXIDE",
  "TEMPERATURE",
  "VENTILATION",
  "HUMIDITY",
  "PRESSURE",
  "VIBRATION",
  "DUST",
  "ELECTRICAL",
  "NOISE",
  "PM10",
  "PM2_5",
  "SO2",
  "NOX",
  "WATER_PH",
  "TURBIDITY",
  "TDS",
  "WATER_FLOW",
  "WATER_LEVEL",
  "ENERGY_METER",
  "RAINFALL",
];

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "#22c55e",
  INACTIVE: "#6b7280",
  MAINTENANCE: "#f59e0b",
  RETIRED: "#ef4444",
};

export default function SensorPlacementPanel({
  blueprintId,
  imageUrl,
  imageWidth,
  imageHeight,
}: {
  blueprintId: string;
  imageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [sensors, setSensors] = useState<SensorConfig[]>([]);
  const [placing, setPlacing] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<[number, number] | null>(null);

  useEffect(() => {
    getSensors().then(setSensors).catch(() => setSensors([]));
  }, [blueprintId]);

  const handleImageClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!placing || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imageWidth;
    const y = ((e.clientY - rect.top) / rect.height) * imageHeight;
    setPendingPoint([Math.round(x), Math.round(y)]);
  };

  const refreshSensors = () => {
    getSensors().then(setSensors).catch(() => {});
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl p-3">
        {imageUrl ? (
          <div className="relative w-full" style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Mine blueprint" className="absolute inset-0 w-full h-full object-contain" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              className={`absolute inset-0 w-full h-full ${placing ? "cursor-crosshair" : "cursor-default"}`}
              onClick={handleImageClick}
            >
              {sensors.map((s) => (
                <g key={s.id}>
                  <circle
                    cx={s.pixel_x}
                    cy={s.pixel_y}
                    r={Math.max(imageWidth, imageHeight) / 130}
                    fill={STATUS_DOT[s.status] ?? "#6b7280"}
                    stroke="#fff"
                    strokeWidth={Math.max(imageWidth, imageHeight) / 800}
                    opacity={0.9}
                  />
                </g>
              ))}
              {pendingPoint && (
                <circle
                  cx={pendingPoint[0]}
                  cy={pendingPoint[1]}
                  r={Math.max(imageWidth, imageHeight) / 110}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={Math.max(imageWidth, imageHeight) / 250}
                  strokeDasharray={`${Math.max(imageWidth, imageHeight) / 100} ${Math.max(imageWidth, imageHeight) / 200}`}
                />
              )}
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-neutral-600 py-24">
            <p className="text-sm">Blueprint image unavailable — sensor placement needs the image to click on.</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase flex items-center gap-1.5">
            <Radio size={13} />
            Place a sensor
          </p>
          {!placing ? (
            <button
              type="button"
              disabled={!imageUrl}
              onClick={() => setPlacing(true)}
              className="w-full px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-colors"
            >
              Start placement
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPlacing(false);
                setPendingPoint(null);
              }}
              className="w-full px-3 py-2 rounded-md text-sm font-medium border border-white/10 text-neutral-300 hover:bg-white/5"
            >
              Click a point on the blueprint…
            </button>
          )}
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
            Registered sensors ({sensors.length})
          </p>
          {sensors.length === 0 ? (
            <p className="text-xs text-neutral-600">None yet — place one on the left.</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {sensors.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-xs bg-white/5 rounded-md px-2.5 py-1.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT[s.status] }} />
                    <span className="truncate text-neutral-200">{s.sensor_id}</span>
                  </span>
                  <Link href={`/admin/sensors/${encodeURIComponent(s.sensor_id)}`} className="text-amber-400 hover:underline shrink-0">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {pendingPoint && (
        <PlaceSensorModal
          blueprintId={blueprintId}
          point={pendingPoint}
          onClose={() => {
            setPendingPoint(null);
            setPlacing(false);
          }}
          onSaved={() => {
            setPendingPoint(null);
            setPlacing(false);
            refreshSensors();
          }}
        />
      )}
    </div>
  );
}

function PlaceSensorModal({
  blueprintId,
  point,
  onClose,
  onSaved,
}: {
  blueprintId: string;
  point: [number, number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sensorId, setSensorId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sensorType, setSensorType] = useState<SensorType>("METHANE");
  const [sectorId, setSectorId] = useState<BlueprintSectorId>("sector_north_wall");
  const [levelLabel, setLevelLabel] = useState("Level -1");
  const [depth, setDepth] = useState("-15");
  const [warningThreshold, setWarningThreshold] = useState("");
  const [criticalThreshold, setCriticalThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const depthNum = Number(depth);
    if (!sensorId.trim() || !displayName.trim() || Number.isNaN(depthNum)) return;
    setBusy(true);
    setError(null);
    try {
      await createSensor({
        sensor_id: sensorId.trim(),
        display_name: displayName.trim(),
        sensor_type: sensorType,
        blueprint_id: blueprintId,
        sector_id: sectorId,
        level_label: levelLabel.trim() || "Level",
        depth: depthNum,
        pixel_x: point[0],
        pixel_y: point[1],
        warning_threshold: warningThreshold === "" ? undefined : Number(warningThreshold),
        critical_threshold: criticalThreshold === "" ? undefined : Number(criticalThreshold),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register sensor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-gray-900 border border-white/10 rounded-xl shadow-xl w-full max-w-md">
        <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Register sensor at ({point[0]}, {point[1]})</h2>
          <button onClick={onClose} aria-label="Close" className="text-neutral-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block text-xs text-neutral-400">
            Sensor ID
            <input
              value={sensorId}
              onChange={(e) => setSensorId(e.target.value)}
              placeholder="e.g. SNS-SEC4-CH4-01"
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block text-xs text-neutral-400">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. North Wall Methane Sensor 1"
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block text-xs text-neutral-400">
            Sensor type
            <select
              value={sensorType}
              onChange={(e) => setSensorType(e.target.value as SensorType)}
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {SENSOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-neutral-400">
            Sector
            <select
              value={sectorId}
              onChange={(e) => setSectorId(e.target.value as BlueprintSectorId)}
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {SECTOR_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="block text-xs text-neutral-400 flex-1">
              Level label
              <input
                value={levelLabel}
                onChange={(e) => setLevelLabel(e.target.value)}
                className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </label>
            <label className="block text-xs text-neutral-400 w-24">
              Depth (m)
              <input
                type="number"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="block text-xs text-neutral-400 flex-1">
              Warning threshold
              <input
                type="number"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </label>
            <label className="block text-xs text-neutral-400 flex-1">
              Critical threshold
              <input
                type="number"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(e.target.value)}
                className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </label>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-3 py-2 rounded-md text-sm text-neutral-300 border border-white/10 hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!sensorId.trim() || !displayName.trim() || busy}
              className="flex-1 px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
            >
              {busy ? "Saving…" : "Save Sensor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
