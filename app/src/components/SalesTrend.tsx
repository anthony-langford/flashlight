import { useMemo, useState } from "react";
import { fmtDate } from "../format";
import type { Tokens } from "../theme";
import type { MarketRow } from "../types";
import { TrendGrid, niceRange, type TrendConfig, type TrendPanelData } from "./TrendGrid";

type Metric = "sp_lp" | "ldom" | "sales";

/** Averages from only a few sales swing wildly, so ratio and time metrics need at least this many. */
export const MIN_SALES_FOR_AVERAGES = 5;

/** A line with fewer points than this is not drawn, and the panel says so. */
export const MIN_POINTS_TO_DRAW = 6;

const METRICS: Record<Metric, { label: string; short: string; help: string }> = {
  sp_lp: {
    label: "Sale price as % of list price",
    short: "Sale / list",
    help: "Above 100% means homes sold for more than the asking price on average, a sign of bidding.",
  },
  ldom: {
    label: "Days on market",
    short: "Days on market",
    help: "How long listings that sold took to sell. Lower means a faster, more competitive market.",
  },
  sales: {
    label: "Sales per month",
    short: "Sales",
    help: "The number of sales. Small districts have few, so this is noisy.",
  },
};

const TYPES = [
  { key: "detached", name: "Detached", color: "series1" as const },
  { key: "semi_detached", name: "Semi-detached", color: "series2" as const },
];

type Props = {
  market: MarketRow[];
  districts: string[];
  labels: Record<string, string>;
  tokens: Tokens;
};

/** Competition signals over time for the target districts, switchable between three metrics. */
export function SalesTrend({ market, districts, labels, tokens }: Props) {
  const [metric, setMetric] = useState<Metric>("sp_lp");
  const months = useMemo(() => [...new Set(market.map((r) => r.period))].sort(), [market]);

  const panels: TrendPanelData[] = useMemo(
    () =>
      districts.map((d) => {
        const lines = TYPES.map((t) => ({
          name: t.name,
          color: t.color,
          pts: market
            .filter((r) => r.area === `Toronto ${d}` && r.home_type === t.key)
            .filter((r) => (metric === "sales" ? r.sales !== null : (r.sales ?? 0) >= MIN_SALES_FOR_AVERAGES))
            .sort((a, b) => a.period.localeCompare(b.period))
            .flatMap((r) => (r[metric] === null ? [] : [[r.period, r[metric] as number] as [string, number]])),
        }));
        // Say so when a line is mostly missing instead of silently leaving it out.
        const thin = lines.filter((l) => l.pts.length < MIN_POINTS_TO_DRAW);
        return {
          id: d,
          title: d,
          subtitle: labels[d] ?? "",
          lines: lines.filter((l) => l.pts.length >= MIN_POINTS_TO_DRAW),
          footer:
            thin.length === 0
              ? undefined
              : `${thin.map((l) => l.name).join(" and ")}: too few months with ${MIN_SALES_FOR_AVERAGES} or more sales to chart.`,
        };
      }),
    [market, districts, labels, metric],
  );

  const config: TrendConfig = useMemo(() => {
    const values = panels.flatMap((p) => p.lines.flatMap((l) => l.pts.map((x) => x[1])));
    const range = niceRange(values, metric === "sp_lp" ? [100] : metric === "sales" ? [0] : []);
    const pct = metric === "sp_lp";
    return {
      range,
      format: (v) => (pct ? `${v.toFixed(0)}%` : metric === "ldom" ? `${v.toFixed(0)} days` : String(Math.round(v))),
      short: (v) => (pct ? `${v}%` : String(Math.round(v))),
      reference: pct ? 100 : undefined,
      ariaLabel: (p) => `${METRICS[metric].label} over time, district ${p.title}`,
    };
  }, [panels, metric]);

  if (months.length < 2) return null;

  return (
    <>
      <h3>Market competition over time</h3>
      <div className="filters" role="group" aria-label="Metric">
        <div className="segmented">
          {(Object.keys(METRICS) as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              className={metric === m ? "seg active" : "seg"}
              onClick={() => setMetric(m)}
            >
              {METRICS[m].short}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">
        <strong>{METRICS[metric].label}.</strong> {METRICS[metric].help}{" "}
        {metric === "sales"
          ? ""
          : `Months with fewer than ${MIN_SALES_FOR_AVERAGES} sales are left out. `}
        {fmtDate(months[0], "monthly")} to {fmtDate(months[months.length - 1], "monthly")}, TRREB
        Market Watch. Older months were recovered from earlier report layouts and every recovered row
        was checked arithmetically.
      </p>
      <ul className="legend small muted" aria-label="Legend">
        {TYPES.map((t) => (
          <li key={t.key}>
            <span className="swatch" style={{ borderColor: `var(--${t.color})` }} aria-hidden="true" /> {t.name}
          </li>
        ))}
        {metric === "sp_lp" && <li><span className="swatch thick" aria-hidden="true" /> 100% = asking price</li>}
      </ul>
      <TrendGrid panels={panels} config={config} tokens={tokens} />
      <details className="table-view">
        <summary>View as a table</summary>
        <div className="table-scroll">
          <table>
            <caption>{METRICS[metric].label} by district and month, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {panels.flatMap((p) =>
                  p.lines.map((l) => (
                    <th key={`${p.id}-${l.name}`} scope="col" className="num">{p.id} {l.name.toLowerCase()}</th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m}>
                  <th scope="row">{fmtDate(m, "monthly")}</th>
                  {panels.flatMap((p) =>
                    p.lines.map((l) => {
                      const v = l.pts.find((x) => x[0] === m)?.[1];
                      return <td key={`${p.id}-${l.name}`} className="num">{v === undefined ? "–" : config.format(v)}</td>;
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
