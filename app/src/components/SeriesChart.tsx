import { useMemo } from "react";
import { esc, fmtDate, fmtValue, isPercent } from "../format";
import type { SeriesSummary } from "../types";
import type { Tokens } from "../theme";
import { Chart } from "./Chart";

type Props = {
  points: [string, number][];
  unit: string;
  frequency: SeriesSummary["frequency"];
  name: string;
  tokens: Tokens;
};

function axisLabel(v: number, unit: string): string {
  const u = unit.toLowerCase();
  if (isPercent(u)) return `${v}%`;
  if (u === "percentage points") return `${v} pp`;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${Math.round(v / 1000)}K`;
  return String(+v.toFixed(2));
}

/** One series as a 2px line with a faint area wash, crosshair tooltip and a labelled end dot. */
export function SeriesChart({ points, unit, frequency, name, tokens: t }: Props) {
  const option = useMemo(() => {
    const last = points[points.length - 1];
    return {
      animation: false,
      grid: { left: 52, right: 84, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        backgroundColor: t.surface,
        borderColor: t.grid,
        textStyle: { color: t.ink },
        axisPointer: { type: "line", lineStyle: { color: t.baseline, width: 1 } },
        formatter: (p: unknown) => {
          const item = (Array.isArray(p) ? p[0] : p) as { value: [string, number] };
          const [d, v] = item.value;
          return (
            `<div style="color:${t.ink2};font-size:12px">${esc(fmtDate(String(d).slice(0, 10), frequency))}</div>` +
            `<div style="display:flex;align-items:center;gap:6px;margin-top:2px">` +
            `<span style="width:12px;height:2px;background:${t.series1};display:inline-block"></span>` +
            `<span style="font-weight:600;color:${t.ink}">${esc(fmtValue(v, unit))}</span>` +
            `<span style="color:${t.ink2};font-size:12px">${esc(name)}</span></div>`
          );
        },
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: t.baseline } },
        axisTick: { show: false },
        axisLabel: { color: t.muted },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.muted, formatter: (v: number) => axisLabel(v, unit) },
        splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" } },
      },
      series: [
        {
          type: "line",
          name,
          data: points,
          showSymbol: false,
          sampling: "lttb",
          lineStyle: { width: 2, color: t.series1, cap: "round", join: "round" },
          itemStyle: { color: t.series1 },
          areaStyle: { color: t.series1, opacity: 0.1 },
          emphasis: { disabled: true },
          endLabel: {
            show: true,
            color: t.ink2,
            formatter: () => fmtValue(last[1], unit),
          },
          markPoint: {
            silent: true,
            symbol: "circle",
            symbolSize: 10,
            itemStyle: { color: t.series1, borderColor: t.surface, borderWidth: 2 },
            label: { show: false },
            data: [{ coord: last }],
          },
        },
      ],
    };
  }, [points, unit, frequency, name, t]);

  return <Chart option={option} height={300} label={`${name} over time`} />;
}
