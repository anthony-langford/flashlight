import { useMemo } from "react";
import { districtHpi, districtRow, latestPeriod, targetDistricts } from "../data";
import { esc, fmtMoney, fmtMoneyCompact, fmtSigned } from "../format";
import type { Tokens } from "../theme";
import type { AppData } from "../types";
import { Chart } from "./Chart";
import { HpiTrend } from "./HpiTrend";

type Props = { data: AppData; tokens: Tokens };

const TYPES = [
  { key: "detached", label: "Detached" },
  { key: "semi_detached", label: "Semi-detached" },
] as const;

function budgetStatus(median: number | null, min: number, max: number): string {
  if (median === null) return "No sales";
  if (median < min) return "Below";
  if (median > max) return "Above";
  return "Within";
}

export function DistrictPanel({ data, tokens: t }: Props) {
  const { buyer, market, hpi } = data;
  const districts = useMemo(() => targetDistricts(buyer), [buyer]);
  const labels = buyer.district_labels;
  const period = latestPeriod(market);
  const hpiPeriod = latestPeriod(hpi);
  const monthName = period
    ? new Date(`${period}T00:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" })
    : "";

  const option = useMemo(() => {
    const cats = [...districts].reverse(); // horizontal bars list top to bottom
    const pick = (type: string) =>
      cats.map((d) => districtHpi(hpi, d, type, hpiPeriod)?.benchmark ?? null);
    const detached = pick("sf_detached");
    const attached = pick("sf_attached");
    const bar = (name: string, color: string, values: (number | null)[], withBand: boolean) => ({
      type: "bar",
      name,
      data: values,
      barWidth: 14,
      itemStyle: { color, borderRadius: [0, 4, 4, 0] },
      emphasis: { itemStyle: { color, opacity: 0.85 } },
      label: {
        show: true,
        position: "right",
        color: t.ink2,
        formatter: (p: { value: number | null }) => (p.value === null ? "" : fmtMoneyCompact(p.value)),
      },
      ...(withBand
        ? {
            markArea: {
              silent: true,
              itemStyle: { color: t.wash },
              data: [[{ xAxis: buyer.budget.min }, { xAxis: buyer.budget.max }]],
            },
          }
        : {}),
    });
    return {
      animation: false,
      grid: { left: 48, right: 64, top: 36, bottom: 24 },
      legend: {
        top: 0,
        left: 0,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 6,
        textStyle: { color: t.ink2 },
        data: ["Single family detached", "Single family attached"],
      },
      tooltip: {
        trigger: "item",
        backgroundColor: t.surface,
        borderColor: t.grid,
        textStyle: { color: t.ink },
        formatter: (p: unknown) => {
          const item = p as { seriesName: string; name: string; value: number | null; color: string };
          const type = item.seriesName.includes("detached") && !item.seriesName.includes("attached")
            ? "sf_detached"
            : "sf_attached";
          const row = districtHpi(hpi, item.name, type, hpiPeriod);
          return (
            `<div style="color:${t.ink2};font-size:12px">${esc(item.name)} ${esc(labels[item.name] ?? "")}</div>` +
            `<div style="display:flex;align-items:center;gap:6px;margin-top:2px">` +
            `<span style="width:12px;height:2px;background:${item.color};display:inline-block"></span>` +
            `<span style="font-weight:600;color:${t.ink}">${item.value === null ? "n/a" : esc(fmtMoney(item.value))}</span>` +
            `<span style="color:${t.ink2};font-size:12px">${esc(item.seriesName)}</span></div>` +
            (row?.yoy_pct != null
              ? `<div style="color:${t.ink2};font-size:12px;margin-top:2px">${esc(fmtSigned(row.yoy_pct, 1, "%"))} vs a year earlier</div>`
              : "")
          );
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.muted, formatter: (v: number) => fmtMoneyCompact(v) },
        splitLine: { lineStyle: { color: t.grid, width: 1, type: "solid" } },
      },
      yAxis: {
        type: "category",
        data: cats,
        axisLine: { lineStyle: { color: t.baseline } },
        axisTick: { show: false },
        axisLabel: { color: t.ink2 },
      },
      series: [
        bar("Single family detached", t.series1, detached, true),
        bar("Single family attached", t.series2, attached, false),
      ],
    };
  }, [districts, hpi, hpiPeriod, buyer.budget, labels, t]);

  if (market.length === 0) {
    return (
      <section className="panel" aria-labelledby="districts-h">
        <h2 id="districts-h">Your target districts</h2>
        <p className="muted">
          TRREB data is not included in this export. Run the export without <code>--no-trreb</code> on
          your own machine to see district figures.
        </p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="districts-h">
      <h2 id="districts-h">Your target districts</h2>
      <p className="muted">
        TRREB Market Watch, {monthName}. District is the finest area TRREB reports monthly.
      </p>

      <ul className="area-list">
        {buyer.target_areas.map((a) => (
          <li key={a.name}>
            <strong>{a.name}</strong> ({a.side} end): {a.districts.join(", ")}{" "}
            <span className={a.confidence === "confident" ? "tag ok" : "tag warn"}>
              {a.confidence === "confident" ? "mapping confirmed" : "mapping unconfirmed"}
            </span>
          </li>
        ))}
      </ul>

      <h3>MLS Home Price Index benchmark</h3>
      <p className="muted small">
        A benchmark price for a typical home that adjusts for the mix of homes sold, so it is steadier
        than the average. Single family attached is the closest HPI category to semi-detached.
      </p>
      <p className="small muted">
        Shaded band: your budget, {fmtMoneyCompact(buyer.budget.min)} to {fmtMoneyCompact(buyer.budget.max)}.
      </p>
      <div className="chart-card">
        <Chart option={option} height={300} label="HPI benchmark price by district and home type" />
      </div>

      <HpiTrend hpi={hpi} districts={districts} labels={labels} budget={buyer.budget} tokens={t} />

      <h3>Sales activity</h3>
      <div className="table-scroll">
        <table>
          <caption>Detached and semi-detached sales by district, {monthName}</caption>
          <thead>
            <tr>
              <th scope="col">District</th>
              <th scope="col">Type</th>
              <th scope="col" className="num">Sales</th>
              <th scope="col" className="num">Average</th>
              <th scope="col" className="num">Median</th>
              <th scope="col" className="num">Sale / list</th>
              <th scope="col" className="num">Days on mkt</th>
              <th scope="col" className="num">New list.</th>
              <th scope="col" className="num">Active list.</th>
              <th scope="col" className="num">Active &divide; sales</th>
              <th scope="col">Median vs budget</th>
            </tr>
          </thead>
          <tbody>
            {districts.flatMap((d) =>
              TYPES.map((ty) => {
                const r = districtRow(market, d, ty.key, period);
                if (!r) return null;
                const ratio = r.sales && r.active_listings !== null ? r.active_listings / r.sales : null;
                return (
                  <tr key={`${d}-${ty.key}`}>
                    <th scope="row">
                      {d} <span className="muted small">{labels[d] ?? ""}</span>
                    </th>
                    <td>{ty.label}</td>
                    <td className="num">
                      {r.sales ?? "n/a"}
                      {r.sales !== null && r.sales < 10 ? <span title="Fewer than 10 sales: treat with caution"> *</span> : null}
                    </td>
                    <td className="num">{r.avg_price ? fmtMoney(r.avg_price) : "n/a"}</td>
                    <td className="num">{r.median_price ? fmtMoney(r.median_price) : "n/a"}</td>
                    <td className="num">{r.sp_lp !== null ? `${r.sp_lp}%` : "n/a"}</td>
                    <td className="num">{r.ldom ?? "n/a"}</td>
                    <td className="num">{r.new_listings ?? "n/a"}</td>
                    <td className="num">{r.active_listings ?? "n/a"}</td>
                    <td className="num">{ratio !== null ? ratio.toFixed(1) : "n/a"}</td>
                    <td>{budgetStatus(r.median_price, buyer.budget.min, buyer.budget.max)}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        * fewer than 10 sales. Sale / list is the average sale price as a share of the list price, so
        above 100% means bidding over asking. Active &divide; sales is active listings divided by the
        month&apos;s sales, a rough months-of-supply gauge and not TRREB&apos;s own measure. Only one
        month of sales activity is loaded so far (older report layouts could not be read), so the sales table has no trend. The benchmark trend above does.
      </p>
    </section>
  );
}
