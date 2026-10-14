import {
  daysSince,
  fmtDate,
  fmtMoneyCompact,
  fmtSigned,
  fmtValue,
  isPercent,
  staleLabel,
} from "../format";
import type { Tokens } from "../theme";
import type { AppData, SeriesSummary } from "../types";
import { DistrictPanel } from "./DistrictPanel";
import { StatTile } from "./StatTile";

type Tile = { id: string; label: string; mode: "level" | "yoy" };

const TILES: Tile[] = [
  { id: "boc.policy_rate", label: "Bank of Canada policy rate", mode: "level" },
  { id: "boc.gov_5y_yield", label: "5-year Government of Canada yield", mode: "level" },
  { id: "boc.mortgage_5y_posted", label: "Posted 5-year mortgage rate", mode: "level" },
  { id: "statcan.toronto.unemployment_rate", label: "Toronto unemployment rate", mode: "level" },
  { id: "statcan.toronto.cpi_shelter", label: "Toronto shelter inflation", mode: "yoy" },
];

function seriesTile(s: SeriesSummary, tile: Tile) {
  const yoy = tile.mode === "yoy" && s.yoy_pct !== null;
  const value = yoy ? fmtSigned(s.yoy_pct!, 1, "%") : fmtValue(s.latest.value, s.unit);
  let delta = null;
  if (!yoy && s.change_1y_abs !== null) {
    const c = s.change_1y_abs;
    const pct = isPercent(s.unit);
    delta = {
      text: `${fmtSigned(c, 2, pct ? " pp" : "")} vs a year earlier`,
      direction: c > 0.0049 ? ("up" as const) : c < -0.0049 ? ("down" as const) : ("flat" as const),
    };
  }
  return (
    <StatTile
      key={s.id}
      label={tile.label + (yoy ? ", year over year" : "")}
      value={value}
      delta={delta}
      asOf={`${fmtDate(s.latest.date, s.frequency)} · ${staleLabel(daysSince(s.latest.date))}`}
    />
  );
}

export function Overview({ data, tokens }: { data: AppData; tokens: Tokens }) {
  const byId = new Map(data.catalogue.map((s) => [s.id, s]));
  const hpi = data.hpi
    .filter((r) => r.area === "City of Toronto" && r.home_type === "sf_detached")
    .sort((a, b) => b.period.localeCompare(a.period))[0];

  return (
    <>
      <section aria-labelledby="snapshot-h">
        <h2 id="snapshot-h">Market snapshot</h2>
        <p className="muted">
          Most of these figures update monthly or less often, so each tile shows when it was last
          updated.
        </p>
        <div className="tiles">
          {TILES.map((t) => {
            const s = byId.get(t.id);
            return s ? seriesTile(s, t) : null;
          })}
          {hpi && hpi.benchmark !== null && (
            <StatTile
              label="City of Toronto detached benchmark price"
              value={fmtMoneyCompact(hpi.benchmark)}
              delta={
                hpi.yoy_pct !== null
                  ? {
                      text: `${fmtSigned(hpi.yoy_pct, 1, "%")} vs a year earlier`,
                      direction: hpi.yoy_pct > 0 ? "up" : hpi.yoy_pct < 0 ? "down" : "flat",
                    }
                  : null
              }
              asOf={`${fmtDate(hpi.period, "monthly")} · TRREB MLS HPI`}
            />
          )}
        </div>
      </section>
      <DistrictPanel data={data} tokens={tokens} />
    </>
  );
}
