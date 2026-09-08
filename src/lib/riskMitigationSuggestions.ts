// Maps anomaly_factors strings returned by T2's risk_scoring.calculate_risk_index
// (read-only reference, never modified — see CLAUDE.md §1) to human-readable
// mitigation suggestions. Purely frontend-side logic.

type SensorKey = "ch4_pct" | "co_ppm" | "dust_pm10" | "displacement_mm" | "temp_c";

const SENSOR_SUGGESTIONS: Record<SensorKey, { label: string; suggestion: string }> = {
  ch4_pct: {
    label: "Methane approaching statutory limit",
    suggestion: "Increase ventilation airflow to the sector; halt hot-work permits; re-check gas detector calibration.",
  },
  co_ppm: {
    label: "Carbon monoxide elevated",
    suggestion: "Evacuate non-essential personnel; inspect for incomplete-combustion sources; boost auxiliary ventilation.",
  },
  dust_pm10: {
    label: "Particulate levels rising",
    suggestion: "Activate dust suppression (water spraying); check ventilation filters.",
  },
  displacement_mm: {
    label: "Strata displacement trending up",
    suggestion: "Flag for geotechnical inspection; restrict access pending roof-bolt check.",
  },
  temp_c: {
    label: "Ambient temperature elevated",
    suggestion: "Check for spontaneous-combustion indicators; increase cooling/ventilation.",
  },
};

const GENERIC_SUGGESTION = {
  label: "Unclassified anomaly pattern",
  suggestion: "Sensor readings don't match a single known factor — flag the sector for manual inspection.",
};

export interface MitigationSuggestion {
  factor: string;
  label: string;
  suggestion: string;
}

function extractSensorKey(factor: string): SensorKey | null {
  for (const key of Object.keys(SENSOR_SUGGESTIONS) as SensorKey[]) {
    if (factor.startsWith(key) || factor.includes(`BREACH: ${key}`)) return key;
  }
  return null;
}

export function suggestionsForFactors(factors: string[]): MitigationSuggestion[] {
  return factors.map((factor) => {
    const key = extractSensorKey(factor);
    const { label, suggestion } = key ? SENSOR_SUGGESTIONS[key] : GENERIC_SUGGESTION;
    return { factor, label, suggestion };
  });
}
