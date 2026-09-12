"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import {
  getSensor,
  getSensorHistory,
  updateSensor,
  updateSensorStatus,
  SENSOR_TYPE_WITH_LIVE_METRIC,
  type SensorConfig,
  type SensorConfigStatus,
  type SensorHistoryEntry,
} from "@/lib/sensorsApi";
import Tabs from "@/components/ui/Tabs";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

const STATUS_BADGE: Record<SensorConfigStatus, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  INACTIVE: "bg-neutral-500/15 text-neutral-400",
  MAINTENANCE: "bg-amber-500/15 text-amber-400",
  RETIRED: "bg-red-500/15 text-red-400",
};

export default function SensorDetailPage() {
  const params = useParams<{ sensorId: string }>();
  const sensorId = decodeURIComponent(params.sensorId);

  const [sensor, setSensor] = useState<SensorConfig | null>(null);
  const [history, setHistory] = useState<SensorHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "calibration" | "history">("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<SensorConfigStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setLoading(true);
    Promise.all([getSensor(sensorId), getSensorHistory(sensorId)])
      .then(([s, h]) => {
        setSensor(s);
        setHistory(h);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sensor"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorId]);

  const confirmStatusChange = async () => {
    if (!pendingStatus) return;
    setBusy(true);
    try {
      await updateSensorStatus(sensorId, pendingStatus);
      setPendingStatus(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error || !sensor) return <p className="text-sm text-red-400">{error ?? "Sensor not found"}</p>;

  const isLiveEnforced = sensor.sensor_type in SENSOR_TYPE_WITH_LIVE_METRIC;

  return (
    <div className="space-y-4">
      <Link href="/admin/mine/sensors" className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white">
        <ArrowLeft size={13} /> Back to Sensor Registry
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            {sensor.sensor_id}
            <Badge label={sensor.status} className={STATUS_BADGE[sensor.status]} />
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {sensor.display_name} · {sensor.sensor_type.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setEditOpen(true)}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 text-neutral-300 hover:bg-white/5"
          >
            Edit
          </button>
          {sensor.status !== "RETIRED" && (
            <button
              onClick={() => setPendingStatus(sensor.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-white/10 text-neutral-300 hover:bg-white/5"
            >
              {sensor.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
            </button>
          )}
          {sensor.status !== "RETIRED" && (
            <button
              onClick={() => setPendingStatus("RETIRED")}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Retire
            </button>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "calibration", label: "Calibration" },
          { id: "history", label: "History" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as "overview" | "calibration" | "history")}
      />

      {tab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">Location</p>
            <Row label="Level" value={sensor.level_label} />
            <Row label="Sector" value={sensor.sector_id.replace(/^sector_/, "").replace(/_/g, " ")} />
            <Row label="Depth" value={`${sensor.depth} m`} />
            <Row label="Blueprint position" value={`x: ${sensor.pixel_x.toFixed(0)}, y: ${sensor.pixel_y.toFixed(0)}`} />
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">Live Reading</p>
            {sensor.current_reading ? (
              <>
                <Row label="Risk score" value={String(sensor.current_reading.risk_score)} />
                <Row label="Risk level" value={sensor.current_reading.risk_level} />
                <Row label="Last update" value={new Date(sensor.current_reading.timestamp).toLocaleString()} />
              </>
            ) : (
              <p className="text-xs text-neutral-600">Not currently reporting telemetry.</p>
            )}
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">Thresholds</p>
            {isLiveEnforced ? (
              <p className="text-[11px] text-emerald-400/80">
                Live-enforced: our backend re-checks every {SENSOR_TYPE_WITH_LIVE_METRIC[sensor.sensor_type]} reading
                against these values and escalates this sensor&apos;s risk level on breach — it can only raise Team
                2&apos;s assessment, never lower it. Changing a value here takes effect within ~15s.
              </p>
            ) : (
              <p className="text-[11px] text-amber-400/80">
                Governance record only — {sensor.sensor_type.replace(/_/g, " ").toLowerCase()} sensors have no
                matching live telemetry field yet, so this threshold isn&apos;t evaluated. Methane, Carbon
                Monoxide, Temperature, Dust, and Vibration sensors are live-enforced.
              </p>
            )}
            <Row label="Warning" value={sensor.warning_threshold != null ? String(sensor.warning_threshold) : "—"} />
            <Row label="Critical" value={sensor.critical_threshold != null ? String(sensor.critical_threshold) : "—"} />
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">Identity</p>
            <Row label="Manufacturer" value={sensor.manufacturer ?? "—"} />
            <Row label="Model" value={sensor.model ?? "—"} />
            <Row label="Installed" value={sensor.installation_date ?? "—"} />
          </div>
        </div>
      )}

      {tab === "calibration" && (
        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2 max-w-md">
          <Row label="Last calibration" value={sensor.last_calibration_at ?? "Never recorded"} />
          <Row label="Next calibration" value={sensor.next_calibration_at ?? "Not scheduled"} />
          <Row label="Status" value={sensor.calibration_status ?? "Not set"} />
        </div>
      )}

      {tab === "history" && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          {history.length === 0 ? (
            <p className="text-sm text-neutral-500 p-4">No history recorded yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-neutral-200">{entry.description}</span>
                  <span className="text-xs text-neutral-600 shrink-0">{new Date(entry.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EditSensorModal open={editOpen} sensor={sensor} onClose={() => setEditOpen(false)} onSaved={refresh} />

      <Modal open={!!pendingStatus} onClose={() => setPendingStatus(null)} title="Confirm action">
        {pendingStatus && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-amber-400">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-200">
                {pendingStatus === "RETIRED"
                  ? `Retire ${sensor.sensor_id}? It will be removed from active monitoring but its history is kept.`
                  : `${pendingStatus === "ACTIVE" ? "Reactivate" : "Deactivate"} ${sensor.sensor_id}?`}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPendingStatus(null)} className="px-3 py-1.5 rounded-md text-xs text-neutral-300 hover:bg-white/5">
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={busy}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white"
              >
                {busy ? "Applying…" : "Confirm"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}

function EditSensorModal({
  open,
  sensor,
  onClose,
  onSaved,
}: {
  open: boolean;
  sensor: SensorConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(sensor.display_name);
  const [warningThreshold, setWarningThreshold] = useState(sensor.warning_threshold?.toString() ?? "");
  const [criticalThreshold, setCriticalThreshold] = useState(sensor.critical_threshold?.toString() ?? "");
  const [lastCalibration, setLastCalibration] = useState(sensor.last_calibration_at ?? "");
  const [nextCalibration, setNextCalibration] = useState(sensor.next_calibration_at ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayName(sensor.display_name);
      setWarningThreshold(sensor.warning_threshold?.toString() ?? "");
      setCriticalThreshold(sensor.critical_threshold?.toString() ?? "");
      setLastCalibration(sensor.last_calibration_at ?? "");
      setNextCalibration(sensor.next_calibration_at ?? "");
    }, 0);
    return () => clearTimeout(timer);
  }, [sensor]);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateSensor(sensor.sensor_id, {
        display_name: displayName,
        warning_threshold: warningThreshold === "" ? undefined : Number(warningThreshold),
        critical_threshold: criticalThreshold === "" ? undefined : Number(criticalThreshold),
        last_calibration_at: lastCalibration || undefined,
        next_calibration_at: nextCalibration || undefined,
      });
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save sensor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit sensor">
      <div className="space-y-3">
        <label className="block text-xs text-neutral-400">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </label>
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
        <div className="flex gap-2">
          <label className="block text-xs text-neutral-400 flex-1">
            Last calibration
            <input
              type="date"
              value={lastCalibration}
              onChange={(e) => setLastCalibration(e.target.value)}
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block text-xs text-neutral-400 flex-1">
            Next calibration
            <input
              type="date"
              value={nextCalibration}
              onChange={(e) => setNextCalibration(e.target.value)}
              className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </label>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={handleSave}
          disabled={busy}
          className="w-full px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
