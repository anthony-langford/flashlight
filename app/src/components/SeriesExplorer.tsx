import { useEffect, useMemo, useState } from "react";
import { LAYER_LABELS, LAYER_ORDER, RANGES, loadSeries, sliceRange, type RangeKey } from "../data";
import { daysSince, fmtDate, fmtSigned, fmtValue, staleLabel } from "../format";
import type { Tokens } from "../theme";
import type { SeriesData, SeriesSummary } from "../types";
import { SeriesChart } from "./SeriesChart";
import { SeriesTable } from "./SeriesTable";

type Props = {
  catalogue: SeriesSummary[];
  tokens: Tokens;
  initialId?: string;
  onSelect?: (id: string) => void;
};

const isIndex = (s: SeriesSummary) => s.unit.toLowerCase().startsWith("index");

/** Latest figure for the list: year-over-year for index series, the level otherwise. */
function listValue(s: SeriesSummary): string {
  if (isIndex(s) && s.yoy_pct !== null) return `${fmtSigned(s.yoy_pct, 1, "%")} y/y`;
  return fmtValue(s.latest.value, s.unit);
}

export function SeriesExplorer({ catalogue, tokens, initialId, onSelect }: Props) {
  const [selectedId, setSelectedIdState] = useState(initialId ?? "boc.gov_5y_yield");
  const setSelectedId = (id: string) => {
    setSelectedIdState(id);
    onSelect?.(id);
  };
  const [range, setRange] = useState<RangeKey>("10Y");
  const [view, setView] = useState<"level" | "yoy">("yoy");
  const [data, setData] = useState<SeriesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(catalogue.map((s) => [s.id, s])), [catalogue]);
  const selected = byId.get(selectedId) ?? catalogue[0];

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadSeries(selected.id)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [selected.id]);

  // The chart keeps showing the previous series (dimmed) until the new one arrives, and it is
  // described by the series it actually holds, not the one just selected.
  const shown = data ? byId.get(data.id) : undefined;
  const pending = !error && (!data || data.id !== selected.id);
  const index = isIndex(selected);
  const showYoy = !!shown && isIndex(shown) && view === "yoy" && !!data?.yoy;
  const base = data ? (showYoy ? data.yoy! : data.obs) : null;
  const points = useMemo(() => (base ? sliceRange(base, range) : []), [base, range]);
  const unit = showYoy ? "percent" : (shown?.unit ?? selected.unit);
  const name = shown ? (showYoy ? `${shown.title}, year over year` : shown.title) : selected.title;

  const groups = useMemo(() => {
    const m = new Map<string, SeriesSummary[]>();
    for (const s of catalogue) m.set(s.layer, [...(m.get(s.layer) ?? []), s]);
    return LAYER_ORDER.filter((l) => m.has(l)).map((l) => ({ layer: l, items: m.get(l)! }));
  }, [catalogue]);

  const ex = selected.explainer;
  const sinceYear = selected.first_obs.slice(0, 4);

  return (
    <div className="explorer">
      <nav className="series-list" aria-label="Indicators">
        {groups.map((g) => (
          <section key={g.layer}>
            <h3>{LAYER_LABELS[g.layer] ?? g.layer}</h3>
            <ul>
              {g.items.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === selected.id ? "series-item active" : "series-item"}
                    aria-current={s.id === selected.id ? "true" : undefined}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <span className="series-item-title">{s.title}</span>
                    <span className="series-item-value">{listValue(s)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="detail">
        <header>
          <h2>{selected.title}</h2>
          <p className="muted">
            {selected.geography} &middot; {selected.frequency}
            {selected.seasonal_adj ? " · seasonally adjusted" : ""}
          </p>
        </header>

        <div className="filters" role="group" aria-label="Chart range">
          <div className="segmented">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                className={range === r ? "seg active" : "seg"}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          {index && (
            <div className="segmented" role="group" aria-label="Value type">
              <button
                type="button"
                aria-pressed={view === "yoy"}
                className={view === "yoy" ? "seg active" : "seg"}
                onClick={() => setView("yoy")}
              >
                Year over year
              </button>
              <button
                type="button"
                aria-pressed={view === "level"}
                className={view === "level" ? "seg active" : "seg"}
                onClick={() => setView("level")}
              >
                Index level
              </button>
            </div>
          )}
        </div>

        <div className={pending && points.length > 0 ? "chart-card loading" : "chart-card"}>
          {error ? (
            <p className="error">{error}</p>
          ) : points.length > 0 ? (
            <SeriesChart
              points={points}
              unit={unit}
              frequency={(shown ?? selected).frequency}
              name={name}
              tokens={tokens}
            />
          ) : (
            <p className="muted pad">Loading&hellip;</p>
          )}
        </div>
        {points.length > 0 && (
          <SeriesTable
            points={points}
            unit={unit}
            frequency={(shown ?? selected).frequency}
            valueLabel={name}
          />
        )}

        <div className="facts">
          <div>
            <div className="fact-label">Latest reading</div>
            <div className="fact-value">{fmtValue(selected.latest.value, selected.unit)}</div>
            <div className="muted small">
              {fmtDate(selected.latest.date, selected.frequency)} &middot;{" "}
              {staleLabel(daysSince(selected.latest.date))}
              {index && selected.yoy_pct !== null
                ? ` \u00B7 ${fmtSigned(selected.yoy_pct, 1, "%")} year over year`
                : ""}
            </div>
          </div>
          <div>
            <div className="fact-label">Compared with its own history</div>
            <div
              className="meter"
              role="img"
              aria-label={`${selected.percentile} percent of readings since ${sinceYear} were at or below the latest`}
            >
              <div className="meter-fill" style={{ width: `${selected.percentile}%` }} />
            </div>
            <div className="muted small">
              {selected.percentile}% of {index ? "year-over-year rates" : "readings"} since {sinceYear} were at or below the latest
            </div>
          </div>
        </div>

        {ex && (
          <section className="explainer">
            <h3>What it is</h3>
            <p>{ex.what}</p>
            <h3>Why it matters for a buyer</h3>
            <p>{ex.why_it_matters}</p>
            <h3>How to read it</h3>
            <p>{ex.how_to_read}</p>
            {ex.moves_with.length > 0 && (
              <>
                <h3>Moves with</h3>
                <div className="chips">
                  {ex.moves_with
                    .filter((id) => byId.has(id))
                    .map((id) => (
                      <button key={id} type="button" className="chip" onClick={() => setSelectedId(id)}>
                        {byId.get(id)!.title}
                      </button>
                    ))}
                </div>
              </>
            )}
            <p className="muted small draft-note">
              Explainer text is a draft and has not been reviewed yet.
            </p>
          </section>
        )}

        <section className="source">
          <h3>Source</h3>
          <p className="small">
            {selected.source}
            {selected.source_ref ? ` · ${selected.source_ref}` : ` · ${selected.source_id}`}
            {selected.verified_on ? ` · verified ${selected.verified_on}` : ""}
          </p>
          {selected.licence_note && <p className="muted small">{selected.licence_note}</p>}
        </section>
      </div>
    </div>
  );
}
