import { useMemo } from "react";
import { esc, fmtDate, fmtMoney, fmtMoneyCompact, fmtSigned } from "../format";
import type { Tokens } from "../theme";
import type { Buyer, HpiRow } from "../types";
import { Chart } from "./Chart";

type Props = {
  hpi: HpiRow[];
  districts: string[];
  labels: Record<string, string>;
  budget: Buyer["budget"];
  tokens: Tokens;
};

type Pt = [string, number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function series(hpi: HpiRow[], district: string, type: string): Pt[] {
  return hpi
    .filter((r) => r.area === `Toronto ${district}` && r.home_type === type && r.benchmark !== null)
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((r) => [r.period, r.benchmark as number]);
}

/** Round the shared axis outward to $200K steps (the tick spacing) so every panel is comparable. */
export function sharedRange(values: number[], budget: Buyer["budget"]): { min: number; max: number } {
  const lo = Math.min(...values, budget.min);
  const hi = Math.max(...values, budget.max);
  return { min: Math.floor(lo / 200_000) * 200_000, max: Math.ceil(hi / 200_000) * 200_000 };
}

/** One small chart per district: detached and attached benchmark over time, on a shared axis. */
export function HpiTrend({ hpi, districts, labels, budget, tokens: t }: Props) {
  const data = useMemo(
    () =>
      districts.map((d) => ({
        district: d,
        detached: series(hpi, d, "sf_detached"),
        attached: series(hpi, d, "sf_attached"),
      })),
    [hpi, districts],
  );
  const range = useMemo(
    () => sharedRange(data.flatMap((d) => [...d.detached, ...d.attached].map((p) => p[1])), budget),
    [data, budget],
  );
  const months = useMemo(
    () => [...new Set(hpi.map((r) => r.period))].sort(),
    [hpi],
  );
  if (months.length < 2) return null;

  return (
    <>
      <h3>Benchmark price trend</h3>
      <p className="muted small">
        {fmtDate(months[0], "monthly")} to {fmtDate(months[months.length - 1], "monthly")}, TRREB MLS
        HPI. Every panel uses the same price axis so districts can be compared. The shaded band is your
        budget. Months before September 2026 were read from older TRREB report layouts and their
        year-over-year changes agree with the figures TRREB reports. Small districts such as E02 and W07 have noisy benchmarks, so judge them over a year or more, not month to month.
      </p>
      <ul className="legend small muted" aria-label="Legend">
        <li><span className="swatch" style={{ borderColor: "var(--series1)" }} aria-hidden="true" /> Single family detached</li>
        <li><span className="swatch" style={{ borderColor: "var(--series2)" }} aria-hidden="true" /> Single family attached</li>
      </ul>
      <div className="trend-grid">
        {data.map((d) => (
          <TrendPanel key={d.district} d={d} label={labels[d.district] ?? ""} range={range} budget={budget} t={t} />
        ))}
      </div>
      <details className="table-view">
        <summary>View trend data as a table</summary>
        <div className="table-scroll">
          <table>
            <caption>HPI benchmark price by district and month, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {districts.flatMap((d) => [
                  <th key={`${d}-d`} scope="col" className="num">{d} detached</th>,
                  <th key={`${d}-a`} scope="col" className="num">{d} attached</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m}>
                  <th scope="row">{fmtDate(m, "monthly")}</th>
                  {data.flatMap((d) => {
                    const find = (pts: Pt[]) => pts.find((p) => p[0] === m)?.[1];
                    const det = find(d.detached);
                    const att = find(d.attached);
                    return [
                      <td key={`${d.district}-d`} className="num">{det ? fmtMoney(det) : "n/a"}</td>,
                      <td key={`${d.district}-a`} className="num">{att ? fmtMoney(att) : "n/a"}</td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function TrendPanel({
  d,
  label,
  range,
  budget,
  t,
}: {
  d: { district: string; detached: Pt[]; attached: Pt[] };
  label: string;
  range: { min: number; max: number };
  budget: Buyer["budget"];
  t: Tokens;
}) {
  const option = useMemo(() => {
    const line = (name: string, color: string, pts: Pt[], withBand: boolean) => {
      const last = pts[pts.length - 1];
      return {
        type: "line",
        name,
        data: pts,
        showSymbol: false,
        lineStyle: { width: 2, color, cap: "round", join: "round" },
        itemStyle: { color },
        emphasis: { disabled: true },
        endLabel: last
          ? { show: true, color: t.ink2, formatter: () => fmtMoneyCompact(last[1]) }
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
        markArea: withBand
          ? {
              silent: true,
              itemStyle: { color: t.wash },
              data: [[{ yAxis: budget.min }, { yAxis: budget.max }]],
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
          const items = (Array.isArray(p) ? p : [p]) as {
            value: [string, number];
            seriesName: string;
            color: string;
          }[];
          if (items.length === 0) return "";
          const date = String(items[0].value[0]).slice(0, 10);
          const rows = items
            .map(
              (i) =>
                `<div style="display:flex;align-items:center;gap:6px;margin-top:2px">` +
                `<span style="width:12px;height:2px;background:${i.color};display:inline-block"></span>` +
                `<span style="font-weight:600;color:${t.ink}">${esc(fmtMoney(i.value[1]))}</span>` +
                `<span style="color:${t.ink2};font-size:12px">${esc(i.seriesName)}</span></div>`,
            )
            .join("");
          return `<div style="color:${t.ink2};font-size:12px">${esc(d.district)}, ${esc(fmtDate(date, "monthly"))}</div>${rows}`;
        },
      },
      xAxis: {
        type: "time",
        splitNumber: 3,
        axisLine: { lineStyle: { color: t.baseline } },
        axisTick: { show: false },
        // One short label per tick ("Jan 25") so labels never run into each other.
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
        min: range.min,
        max: range.max,
        interval: 200_000,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.muted, formatter: (v: number) => fmtMoneyCompact(v) },
        splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" } },
      },
      series: [
        line("Detached", t.series1, d.detached, true),
        line("Attached", t.series2, d.attached, false),
      ],
    };
  }, [d, range, budget, t]);

  const lastDet = d.detached[d.detached.length - 1];
  const firstDet = d.detached[0];
  const change = lastDet && firstDet ? ((lastDet[1] / firstDet[1] - 1) * 100) : null;

  return (
    <div className="trend-panel">
      <div className="trend-title">
        <strong>{d.district}</strong> <span className="muted small">{label}</span>
      </div>
      <div className="chart-card">
        <Chart option={option} height={210} label={`HPI benchmark price over time, district ${d.district}`} />
      </div>
      {change !== null && (
        <div className="muted small">
          Detached {fmtSigned(change, 1, "%")} since {fmtDate(firstDet[0], "monthly")}
        </div>
      )}
    </div>
  );
}
