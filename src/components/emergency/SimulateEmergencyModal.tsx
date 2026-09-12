"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { formatSectorId } from "@/lib/format";
import { simulateEmergencyEvent } from "@/lib/emergencyApi";
import type { HazardType } from "../../../shared/types/emergency";

export default function SimulateEmergencyModal({
  open,
  onClose,
  onSimulated,
  sectorOptions,
}: {
  open: boolean;
  onClose: () => void;
  onSimulated: () => void;
  sectorOptions: string[];
}) {
  const [sectorId, setSectorId] = useState(sectorOptions[0] ?? "sector_north_wall");
  const [value, setValue] = useState("3.0");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hazardType: HazardType = "METHANE";

  async function handleSubmit() {
    if (!confirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await simulateEmergencyEvent({
        hazard_type: hazardType,
        sector_id: sectorId,
        sensor_id: `demo-ch4-${Date.now()}`,
        value: parseFloat(value),
      });
      onSimulated();
      onClose();
      setConfirmed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to simulate emergency");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Simulate Emergency (Demo)">
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-300">
          DEMO / SIMULATED EVENT — this injects a synthetic reading into the emergency detection engine for
          demonstration purposes. It never touches the AI risk model's real data, and no real notification, alarm,
          or external system will be contacted.
        </div>

        <div>
          <label className="text-xs text-neutral-400 block mb-1">Hazard type</label>
          <input
            value="Methane (CH4)"
            disabled
            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-neutral-400"
          />
          <p className="text-[11px] text-neutral-600 mt-1">Only methane is wired up in this prototype.</p>
        </div>

        <div>
          <label className="text-xs text-neutral-400 block mb-1">Sector</label>
          <select
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm"
          >
            {sectorOptions.map((id) => (
              <option key={id} value={id}>
                {formatSectorId(id)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-neutral-400 block mb-1">CH4 reading (% CH4)</label>
          <input
            type="number"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-neutral-600 mt-1">Critical threshold is 2.5% CH4 by default.</p>
        </div>

        <label className="flex items-start gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          I understand this is a SIMULATED EVENT — no real emergency system will be contacted.
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!confirmed || submitting}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-md px-4 py-2 text-sm font-medium"
          >
            {submitting ? "Simulating…" : "Trigger Simulated Emergency"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
