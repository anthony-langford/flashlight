import { useMemo } from "react";
import { fmtDate, fmtMoney, fmtMoneyCompact, fmtSigned } from "../format";
import type { Tokens } from "../theme";
import type { Buyer, HpiRow } from "../types";
import { TrendGrid, type TrendConfig, type TrendPanelData } from "./TrendGrid";

type Props = {
  hpi: HpiRow[];
  districts: string[];
  labels: Record<string, string>;
  budget: Buyer["budget"];
  tokens: Tokens;
};

type Pt = [string, number];

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
export function HpiTrend({ hpi, districts, labels, budget, tokens }: Props) {
  const panels: TrendPanelData[] = useMemo(
    () =>
      districts.map((d) => {
        const detached = series(hpi, d, "sf_detached");
        const attached = series(hpi, d, "sf_attached");
        const latest = hpi
          .filter((r) => r.area === `Toronto ${d}` && r.home_type === "sf_detached" && r.yoy_pct !== null)
          .sort((a, b) => b.period.localeCompare(a.period))[0];
        return {
          id: d,
          title: d,
          subtitle: labels[d] ?? "",
          lines: [
            { name: "Detached", color: "series1" as const, pts: detached },
            { name: "Attached", color: "series2" as const, pts: attached },
          ],
          // TRREB's own year-over-year for the latest month, not a first-to-last comparison of
          // two noisy monthly readings.
          footer: latest
            ? `Detached ${fmtSigned(latest.yoy_pct as number, 1, "%")} vs a year earlier (${fmtDate(latest.period, "monthly")}, TRREB)`
            : undefined,
        };
      }),
    [hpi, districts, labels],
  );
  const range = useMemo(
    () => sharedRange(panels.flatMap((p) => p.lines.flatMap((l) => l.pts.flatMap((x) => (x[1] === null ? [] : [x[1]])))), budget),
    [panels, budget],
  );
  const months = useMemo(() => [...new Set(hpi.map((r) => r.period))].sort(), [hpi]);
  const config: TrendConfig = useMemo(
    () => ({
      range: { ...range, interval: 200_000 },
      format: fmtMoney,
      short: fmtMoneyCompact,
      band: { from: budget.min, to: budget.max },
      ariaLabel: (p) => `HPI benchmark price over time, district ${p.title}`,
    }),
    [range, budget],
  );
  if (months.length < 2) return null;

  return (
    <>
      <h3>Benchmark price trend</h3>
      <p className="muted small">
        {fmtDate(months[0], "monthly")} to {fmtDate(months[months.length - 1], "monthly")}, TRREB MLS
        HPI. Every panel uses the same price axis so districts can be compared. The shaded band is your
        budget. Months before September 2026 were read from older TRREB report layouts and their
        year-over-year changes agree with the figures TRREB reports. Small districts such as E02 and
        W07 have noisy benchmarks, so judge them over a year or more, not month to month.
      </p>
      <ul className="legend small muted" aria-label="Legend">
        <li><span className="swatch" style={{ borderColor: "var(--series1)" }} aria-hidden="true" /> Single family detached</li>
        <li><span className="swatch" style={{ borderColor: "var(--series2)" }} aria-hidden="true" /> Single family attached</li>
      </ul>
      <TrendGrid panels={panels} config={config} tokens={tokens} />
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
                  {panels.flatMap((p) =>
                    p.lines.map((l) => {
                      const v = l.pts.find((x) => x[0] === m)?.[1];
                      return (
                        <td key={`${p.id}-${l.name}`} className="num">{v ? fmtMoney(v) : "n/a"}</td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
