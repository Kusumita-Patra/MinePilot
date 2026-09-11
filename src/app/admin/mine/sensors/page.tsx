"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPinned, Radio, Search } from "lucide-react";
import {
  getSensors,
  updateSensorStatus,
  type SensorConfig,
  type SensorConfigStatus,
  type SensorType,
} from "@/lib/sensorsApi";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";

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
];
const STATUSES: SensorConfigStatus[] = ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"];

const STATUS_BADGE: Record<SensorConfigStatus, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  INACTIVE: "bg-neutral-500/15 text-neutral-400",
  MAINTENANCE: "bg-amber-500/15 text-amber-400",
  RETIRED: "bg-red-500/15 text-red-400",
};

const CALIBRATION_BADGE: Record<string, string> = {
  VALID: "bg-emerald-500/15 text-emerald-400",
  DUE_SOON: "bg-amber-500/15 text-amber-400",
  OVERDUE: "bg-red-500/15 text-red-400",
};

export default function AdminSensorsPage() {
  const [sensors, setSensors] = useState<SensorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<SensorType | "">("");
  const [statusFilter, setStatusFilter] = useState<SensorConfigStatus | "">("");

  const refresh = () => {
    setLoading(true);
    getSensors({
      sensor_type: typeFilter || undefined,
      status: statusFilter || undefined,
    })
      .then(setSensors)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sensors"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const visibleSensors = sensors.filter(
    (s) =>
      !search.trim() ||
      s.sensor_id.toLowerCase().includes(search.toLowerCase()) ||
      s.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = async (sensor: SensorConfig) => {
    const next = sensor.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateSensorStatus(sensor.sensor_id, next);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update sensor status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Sensor Registry</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Register, configure, and monitor sensors placed on the mine blueprint. Live readings shown here
            come from the existing telemetry stream — this page does not fabricate data.
          </p>
        </div>
        <Link
          href="/admin/mine/blueprint"
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors"
        >
          <MapPinned size={14} />
          Place a Sensor
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sensor ID or name…"
            className="w-full pl-8 pr-3 py-2 rounded-md text-sm bg-neutral-900/70 border border-white/10 text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as SensorType | "")}
          className="bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">All types</option>
          {SENSOR_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SensorConfigStatus | "")}
          className="bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && visibleSensors.length === 0 && (
        <EmptyState
          icon={Radio}
          title="No sensors registered yet"
          description="Place a sensor on the mine blueprint to add it to the registry."
          actionLabel="Place a Sensor"
        />
      )}

      {!loading && !error && visibleSensors.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Sensor ID</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Level</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Reading</th>
                <th className="px-4 py-2.5 font-medium">Calibration</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleSensors.map((sensor) => (
                <tr key={sensor.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/sensors/${encodeURIComponent(sensor.sensor_id)}`} className="text-neutral-200 hover:text-amber-400 font-medium">
                      {sensor.sensor_id}
                    </Link>
                    <p className="text-xs text-neutral-500">{sensor.display_name}</p>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 text-xs">{sensor.sensor_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-neutral-400 text-xs">
                    {sensor.sector_id.replace(/^sector_/, "").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 text-xs">{sensor.level_label}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Badge label={sensor.status} className={STATUS_BADGE[sensor.status]} />
                      <span
                        title={sensor.is_reporting ? "Reporting telemetry" : "Not reporting — no recent telemetry"}
                        className={`w-1.5 h-1.5 rounded-full ${sensor.is_reporting ? "bg-emerald-400" : "bg-neutral-600"}`}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-300 text-xs">
                    {sensor.current_reading ? `Risk ${sensor.current_reading.risk_score}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {sensor.calibration_status ? (
                      <Badge
                        label={sensor.calibration_status.replace(/_/g, " ")}
                        className={CALIBRATION_BADGE[sensor.calibration_status]}
                      />
                    ) : (
                      <span className="text-neutral-600 text-xs">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => toggleStatus(sensor)}
                      disabled={sensor.status === "RETIRED"}
                      className="text-xs px-2 py-1 rounded-md border border-white/10 text-neutral-300 hover:bg-white/5 disabled:opacity-30"
                    >
                      {sensor.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
