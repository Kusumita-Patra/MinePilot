export interface TimeRange {
  id: string;
  label: string;
  ms: number;
}

const HOUR = 3600e3;
const DAY = 24 * HOUR;

export const TIME_RANGES: TimeRange[] = [
  { id: "1H", label: "1H", ms: 1 * HOUR },
  { id: "2H", label: "2H", ms: 2 * HOUR },
  { id: "5H", label: "5H", ms: 5 * HOUR },
  { id: "12H", label: "12H", ms: 12 * HOUR },
  { id: "1D", label: "1D", ms: 1 * DAY },
  { id: "2D", label: "2D", ms: 2 * DAY },
  { id: "5D", label: "5D", ms: 5 * DAY },
  { id: "7D", label: "7D", ms: 7 * DAY },
  { id: "15D", label: "15D", ms: 15 * DAY },
  { id: "30D", label: "30D", ms: 30 * DAY },
];

export const DEFAULT_RANGE_ID = "1D";

export function getTimeRange(rangeId: string): TimeRange {
  return TIME_RANGES.find((r) => r.id === rangeId) ?? TIME_RANGES[4];
}

export function rangeToWindow(rangeId: string, now: Date = new Date()): { from: string; to: string } {
  const range = getTimeRange(rangeId);
  return {
    from: new Date(now.getTime() - range.ms).toISOString(),
    to: now.toISOString(),
  };
}

/** Tick-label formatter for the chart's X axis, tuned to the active range's span. */
export function formatRangeTick(timestamp: number, rangeId: string): string {
  const date = new Date(timestamp);
  const range = getTimeRange(rangeId);
  if (range.ms <= 24 * HOUR) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/** Full date+time label used in the hover tooltip, regardless of range. */
export function formatTooltipTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
