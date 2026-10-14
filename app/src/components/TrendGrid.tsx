import { useMemo } from "react";
import { esc, fmtDate } from "../format";
import type { Tokens } from "../theme";
import { Chart } from "./Chart";

export type TrendLine = {
  name: string;
  color: "series1" | "series2";
  /** A null value is a gap: the line breaks there instead of joining across it. */
  pts: [string, number | null][];
};
export type TrendPanelData = {
  id: string;
  title: string;
  subtitle: string;
  lines: TrendLine[];
  footer?: string;
};
export type TrendConfig = {
  range: { min: number; max: number; interval: number };
  /** Full value for tooltips. */
  format: (v: number) => string;
  /** Short value for axis ticks and end labels. */
  short: (v: number) => string;
  /** Shaded horizontal band, such as the buyer's budget. */
  band?: { from: number; to: number };
  /** A solid reference line, such as 100% of the asking price. */
  reference?: number;
  ariaLabel: (panel: TrendPanelData) => string;
};

/** Share of the axis span below which two end labels would collide. */
export const LABEL_GAP = 0.12;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The round tick spacing (1, 2, 5 or 10 times a power of ten) nearest to span / ticks. */
export function niceInterval(span: number, ticks = 4): number {
  if (span <= 0) return 1;
  const raw = span / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

/** Axis bounds rounded outward to the tick spacing, so every panel can share one scale. */
export function niceRange(
  values: number[],
  include: number[] = [],
  ticks = 4,
): { min: number; max: number; interval: number } {
  const all = [...values, ...include];
  if (all.length === 0) return { min: 0, max: 1, interval: 1 };
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const interval = niceInterval(hi - lo, ticks);
  return {
    min: Math.floor(lo / interval) * interval,
    max: Math.ceil(hi / interval) * interval,
    interval,
  };
}

/** Small multiples: one chart per panel, a shared axis, a line per series. */
export function TrendGrid({
  panels,
  config,
  tokens,
}: {
  panels: TrendPanelData[];
  config: TrendConfig;
  tokens: Tokens;
}) {
  return (
    <div className="trend-grid">
      {panels.map((p) => (
        <TrendPanel key={p.id} panel={p} config={config} t={tokens} />
      ))}
    </div>
  );
}

function TrendPanel({ panel, config, t }: { panel: TrendPanelData; config: TrendConfig; t: Tokens }) {
  const option = useMemo(() => {
    // When the lines end close together their end labels would overlap, so only the first keeps
    // one. The legend and the tooltip still give both values.
    const lastPoint = (l: TrendLine) => [...l.pts].reverse().find((p) => p[1] !== null) as [string, number] | undefined;
    const ends = panel.lines.map((l) => lastPoint(l)?.[1]);
    const span = config.range.max - config.range.min || 1;
    const labelEnd = (i: number) =>
      i === 0 || ends.slice(0, i).every((e) => e === undefined || ends[i] === undefined || Math.abs((e as number) - (ends[i] as number)) / span > LABEL_GAP);
    const line = (l: TrendLine, first: boolean, index: number) => {
      const color = t[l.color];
      const last = lastPoint(l);
      return {
        type: "line",
        name: l.name,
        data: l.pts,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, color, cap: "round", join: "round" },
        itemStyle: { color },
        emphasis: { disabled: true },
        endLabel:
          last && labelEnd(index)
            ? { show: true, color: t.ink2, formatter: () => config.short(last[1]) }
            : { show: false },
        markPoint: last
          ? {
              silent: true,
              symbol: "circle",
              symbolSize: 9,
              itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
              label: { show: false },
              data: [{ coord: last }],
            }
          : undefined,
        markArea:
          first && config.band
            ? {
                silent: true,
                itemStyle: { color: t.wash },
                data: [[{ yAxis: config.band.from }, { yAxis: config.band.to }]],
              }
            : undefined,
        markLine:
          first && config.reference !== undefined
            ? {
                silent: true,
                symbol: "none",
                label: { show: false },
                lineStyle: { color: t.ink2, width: 1, type: "solid" },
                data: [{ yAxis: config.reference }],
              }
            : undefined,
      };
    };
    return {
      animation: false,
      grid: { left: 46, right: 54, top: 10, bottom: 24 },
      tooltip: {
        trigger: "axis",
        backgroundColor: t.surface,
        borderColor: t.grid,
        textStyle: { color: t.ink },
        axisPointer: { type: "line", lineStyle: { color: t.baseline, width: 1 } },
        formatter: (p: unknown) => {
          const items = ((Array.isArray(p) ? p : [p]) as {
            value: [string, number | null];
            seriesName: string;
            color: string;
          }[]).filter((i) => i.value[1] !== null);
          if (items.length === 0) return "";
          const date = String(items[0].value[0]).slice(0, 10);
          const rows = items
            .map(
              (i) =>
                `<div style="display:flex;align-items:center;gap:6px;margin-top:2px">` +
                `<span style="width:12px;height:2px;background:${i.color};display:inline-block"></span>` +
                `<span style="font-weight:600;color:${t.ink}">${esc(config.format(i.value[1] as number))}</span>` +
                `<span style="color:${t.ink2};font-size:12px">${esc(i.seriesName)}</span></div>`,
            )
            .join("");
          return `<div style="color:${t.ink2};font-size:12px">${esc(panel.title)}, ${esc(fmtDate(date, "monthly"))}</div>${rows}`;
        },
      },
      xAxis: {
        type: "time",
        splitNumber: 3,
        axisLine: { lineStyle: { color: t.baseline } },
        axisTick: { show: false },
        axisLabel: {
          color: t.muted,
          hideOverlap: true,
          formatter: (v: number) => {
            const d = new Date(v);
            return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: config.range.min,
        max: config.range.max,
        interval: config.range.interval,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.muted, formatter: (v: number) => config.short(v) },
        splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" } },
      },
      series: panel.lines.map((l, i) => line(l, i === 0, i)),
    };
  }, [panel, config, t]);

  return (
    <div className="trend-panel">
      <div className="trend-title">
        <strong>{panel.title}</strong> <span className="muted small">{panel.subtitle}</span>
      </div>
      <div className="chart-card">
        <Chart option={option} height={210} label={config.ariaLabel(panel)} />
      </div>
      {panel.footer && <div className="muted small">{panel.footer}</div>}
    </div>
  );
}
