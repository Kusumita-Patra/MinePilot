"use client";

import { useCallback, useEffect, useState } from "react";
import { getSensors, type SensorConfig } from "@/lib/sensorsApi";

/** Loads the full registered-sensor list (admin-configured placement +
 * metadata, not live telemetry). Any authenticated role can read this —
 * used by the 3D twin's optional "sensor locations" overlay so a manager
 * can see where sensors are physically placed even if a given one isn't
 * currently streaming. Fails soft to an empty list (e.g. no sensors
 * registered yet) rather than surfacing an error in the 3D view. */
export function useSensorConfigs() {
  const [sensors, setSensors] = useState<SensorConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSensors();
      setSensors(result);
    } catch {
      setSensors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sensors, loading, refresh };
}
