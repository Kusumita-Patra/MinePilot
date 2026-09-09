"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ReferenceDot, ResponsiveContainer } from "recharts";
import clsx from "clsx";
import Tabs from "@/components/ui/Tabs";
import { useTelemetryHistory } from "@/hooks/useTelemetryHistory";
import type { SectorRiskRanking } from "@/lib/api";
import { TIME_RANGES, DEFAULT_RANGE_ID, formatRangeTick, formatTooltipTimestamp } from "@/lib/timeRanges";
import { formatSectorId } from "@/lib/format";
import type { RiskLevel } from "../../../shared/types/telemetry";

interface ChartPoint {
  timestamp: number;
  risk_score: number;
  risk_level: RiskLevel;
  ch4_pct: number;
  co_ppm: number;
  dust_pm10: number;
  displacement_mm: number;
  temp_c: number;
}

type MetricId = "risk_score" | "ch4_pct" | "co_ppm" | "dust_pm10" | "displacement_mm" | "temp_c";

interface MetricDef {
  id: MetricId;
  label: string;
  unit: string;
  domain?: [number, number];
  decimals: number;
}

const METRICS: MetricDef[] = [
  { id: "risk_score", label: "Risk Score", unit: "", domain: [0, 100], decimals: 0 },
  { id: "ch4_pct", label: "CH₄", unit: "%", decimals: 2 },
  { id: "co_ppm", label: "CO", unit: " ppm", decimals: 1 },
  { id: "dust_pm10", label: "Dust PM10", unit: "", decimals: 1 },
  { id: "displacement_mm", label: "Displacement", unit: " mm", decimals: 2 },
  { id: "temp_c", label: "Temp", unit: "°C", decimals: 1 },
];

const riskColor: Record<RiskLevel, string> = {
  NORMAL: "text-emerald-400",
  WARNING: "text-amber-400",
  CRITICAL: "text-red-500",
};

function fmt(value: number, metric: MetricDef): string {
  return `${value.toFixed(metric.decimals)}${metric.unit}`;
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

// Piecewise-linear interpolation between the two data points bracketing
// `timestamp`, so a hovered value sits exactly on the drawn (linear) curve
// instead of snapping to whichever sample is nearest.
function interpolateChartPoint(data: ChartPoint[], timestamp: number): ChartPoint {
  const first = data[0];
  const last = data[data.length - 1];
  if (timestamp <= first.timestamp) return first;
  if (timestamp >= last.timestamp) return last;

  let lo = 0;
  let hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (data[mid].timestamp <= timestamp) lo = mid;
    else hi = mid;
  }
  const p1 = data[lo];
  const p2 = data[hi];
  if (p2.timestamp === p1.timestamp) return p1;
  const f = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);

  return {
    timestamp,
    risk_score: lerp(p1.risk_score, p2.risk_score, f),
    risk_level: f < 0.5 ? p1.risk_level : p2.risk_level,
    ch4_pct: lerp(p1.ch4_pct, p2.ch4_pct, f),
    co_ppm: lerp(p1.co_ppm, p2.co_ppm, f),
    dust_pm10: lerp(p1.dust_pm10, p2.dust_pm10, f),
    displacement_mm: lerp(p1.displacement_mm, p2.displacement_mm, f),
    temp_c: lerp(p1.temp_c, p2.temp_c, f),
  };
}

// Must match the AreaChart's `margin`/`height` props and the axes' `width`/
// `height` props below exactly — this is how raw mouse-pixel coordinates get
// converted back to data values (and back to pixels) without relying on
// Recharts' own (index-snapped) hover state.
const CHART_MARGIN = { top: 5, right: 12, left: 5, bottom: 5 };
const Y_AXIS_WIDTH = 40;
const X_AXIS_HEIGHT = 24;
const CHART_HEIGHT = 256; // matches the wrapper's h-64
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 170;

export default function SectorRiskHistory({
  ranking,
  sectorId,
  onSectorChange,
}: {
  ranking: SectorRiskRanking[];
  sectorId: string | null;
  onSectorChange: (id: string) => void;
}) {
  const [metricId, setMetricId] = useState<MetricId>("risk_score");
  const [rangeId, setRangeId] = useState(DEFAULT_RANGE_ID);
  const [hover, setHover] = useState<{ timestamp: number; mouseX: number; wrapWidth: number } | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  const { points, loading, window: timeWindow } = useTelemetryHistory(sectorId, 500, rangeId);
  const metric = METRICS.find((m) => m.id === metricId)!;

  const chartData: ChartPoint[] = useMemo(
    () =>
      points.map((p) => ({
        timestamp: new Date(p.timestamp).getTime(),
        risk_score: p.risk_score,
        risk_level: p.risk_level,
        ch4_pct: p.telemetry.ch4_pct,
        co_ppm: p.telemetry.co_ppm,
        dust_pm10: p.telemetry.dust_pm10,
        displacement_mm: p.telemetry.displacement_mm,
        temp_c: p.telemetry.temp_c,
      })),
    [points]
  );

  // The axis must span the requested range, not just whatever data came
  // back — a gap at either edge (an ingestion outage, e.g.) would otherwise
  // make the chart silently shrink to the available data instead of showing
  // the true "N hours ago -> now" window the active tab claims to show.
  const domainStart = timeWindow ? new Date(timeWindow.from).getTime() : chartData[0]?.timestamp;
  const domainEnd = timeWindow ? new Date(timeWindow.to).getTime() : chartData[chartData.length - 1]?.timestamp;

  const hoverPoint = useMemo(
    () => (hover && chartData.length > 0 ? interpolateChartPoint(chartData, hover.timestamp) : null),
    [hover, chartData]
  );

  // Exact bounds fed to the YAxis below too, so our manual pixel math always
  // agrees with where Recharts actually draws the line/dot.
  const yDomain: [number, number] = useMemo(() => {
    if (metric.domain) return metric.domain;
    if (chartData.length === 0) return [0, 1];
    let min = Infinity;
    let max = -Infinity;
    for (const d of chartData) {
      const v = d[metricId];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return min === max ? [min - 1, max + 1] : [min, max];
  }, [chartData, metric.domain, metricId]);

  const first = chartData[0];
  const latest = chartData[chartData.length - 1];
  const delta = first && latest ? latest[metricId] - first[metricId] : 0;
  const pctDelta = first && first[metricId] !== 0 ? (delta / first[metricId]) * 100 : 0;
  // Higher is worse for every metric we plot (risk score and all statutory
  // telemetry fields), so — unlike a stock chart — a rising value is bad news.
  const deltaColor = delta > 0 ? "text-red-500" : delta < 0 ? "text-emerald-400" : "text-neutral-400";

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const wrap = chartWrapRef.current;
    if (!wrap || chartData.length === 0) return;
    const rect = wrap.getBoundingClientRect();
    const plotLeft = CHART_MARGIN.left + Y_AXIS_WIDTH;
    const plotRight = rect.width - CHART_MARGIN.right;
    const x = e.clientX - rect.left;
    if (x < plotLeft - 4 || x > plotRight + 4) {
      setHover(null);
      return;
    }
    const fraction = Math.min(1, Math.max(0, (x - plotLeft) / (plotRight - plotLeft)));
    const tMin = domainStart ?? chartData[0].timestamp;
    const tMax = domainEnd ?? chartData[chartData.length - 1].timestamp;
    setHover({ timestamp: tMin + fraction * (tMax - tMin), mouseX: x, wrapWidth: rect.width });
  }

  function handleMouseLeave() {
    setHover(null);
  }

  // Position the tooltip relative to the hovered point itself (not a fixed
  // corner): put it beside the cursor and on whichever half of the chart the
  // point *isn't* in, so it never sits on top of the curve or the dot. We
  // prefer keeping it inside the plot, but don't clamp it back in if that
  // would force an overlap — it's allowed to spill past the chart's own
  // edges into the surrounding card, since staying off the curve matters
  // more than staying inside the h-64 box.
  const GAP = 14;
  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (hover && hoverPoint) {
    const plotTop = CHART_MARGIN.top;
    const plotBottom = CHART_HEIGHT - CHART_MARGIN.bottom - X_AXIS_HEIGHT;
    const [yMin, yMax] = yDomain;
    const valueFraction = yMax === yMin ? 0.5 : (hoverPoint[metricId] - yMin) / (yMax - yMin);
    const dotY = plotBottom - valueFraction * (plotBottom - plotTop);

    const roomRight = hover.wrapWidth - hover.mouseX - GAP;
    const roomLeft = hover.mouseX - GAP;
    tooltipLeft =
      roomRight >= TOOLTIP_WIDTH || roomRight >= roomLeft
        ? hover.mouseX + GAP
        : hover.mouseX - GAP - TOOLTIP_WIDTH;
    tooltipLeft = Math.max(tooltipLeft, -8);

    tooltipTop = dotY < CHART_HEIGHT / 2 ? dotY + GAP : dotY - GAP - TOOLTIP_HEIGHT;
  }

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide">SECTOR RISK HISTORY</p>
        <div className="flex items-center gap-2">
          {ranking.length > 0 && (
            <select
              value={sectorId ?? ""}
              onChange={(e) => onSectorChange(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-md text-xs px-2 py-1"
            >
              {ranking.map((r) => (
                <option key={r.sector_id} value={r.sector_id}>
                  {formatSectorId(r.sector_id)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mb-3">
        <Tabs tabs={METRICS.map((m) => ({ id: m.id, label: m.label }))} activeId={metricId} onChange={(id) => setMetricId(id as MetricId)} />
      </div>

      {loading && chartData.length === 0 ? (
        <p className="text-[11px] text-neutral-600 py-8 text-center">Loading history…</p>
      ) : chartData.length === 0 ? (
        <p className="text-[11px] text-neutral-600 py-8 text-center">
          No telemetry history recorded for this sector yet.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-semibold">
              {fmt((hoverPoint ?? latest)[metricId], metric)}
            </span>
            <span className={clsx("text-xs font-medium", deltaColor)}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {fmt(Math.abs(delta), metric)} ({Math.abs(pctDelta).toFixed(1)}%)
            </span>
            <span className="text-[11px] text-neutral-500">{rangeId}</span>
          </div>

          <div
            ref={chartWrapRef}
            className="h-64 relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="riskHistoryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={[domainStart, domainEnd]}
                  allowDataOverflow
                  tickFormatter={(v) => formatRangeTick(v, rangeId)}
                  tick={{ fontSize: 10, fill: "#737373" }}
                  height={X_AXIS_HEIGHT}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10, fill: "#737373" }}
                  width={Y_AXIS_WIDTH}
                />
                <Area
                  type="linear"
                  dataKey={metricId}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#riskHistoryFill)"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                {hoverPoint && (
                  <>
                    <ReferenceLine x={hoverPoint.timestamp} stroke="#525252" strokeDasharray="4 4" />
                    <ReferenceDot
                      x={hoverPoint.timestamp}
                      y={hoverPoint[metricId]}
                      r={4}
                      fill="#3b82f6"
                      stroke="#0a0a0a"
                      strokeWidth={2}
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>

            {hoverPoint && (
              <div
                className="absolute z-10 pointer-events-none transition-[top,left] duration-100 ease-out"
                style={{ left: tooltipLeft, top: tooltipTop, width: TOOLTIP_WIDTH }}
              >
                <HistoryTooltip point={hoverPoint} />
              </div>
            )}
          </div>

          <div className="mt-3">
            <Tabs tabs={TIME_RANGES} activeId={rangeId} onChange={setRangeId} />
          </div>
        </>
      )}
    </div>
  );
}

function HistoryTooltip({ point }: { point: ChartPoint }) {
  return (
    <div className="bg-[#171717] border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-neutral-400 mb-2">{formatTooltipTimestamp(point.timestamp)}</p>
      <p className="font-semibold mb-2">
        Risk Score: {Math.round(point.risk_score)}{" "}
        <span className={riskColor[point.risk_level]}>({point.risk_level})</span>
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-neutral-300">
        <span>CH₄: {point.ch4_pct.toFixed(2)}%</span>
        <span>CO: {point.co_ppm.toFixed(1)} ppm</span>
        <span>Dust PM10: {point.dust_pm10.toFixed(1)}</span>
        <span>Displacement: {point.displacement_mm.toFixed(2)} mm</span>
        <span>Temp: {point.temp_c.toFixed(1)}°C</span>
      </div>
    </div>
  );
}
