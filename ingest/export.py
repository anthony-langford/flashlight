"""Export the local DuckDB data to static JSON for the front end.

Outputs under `out_dir`:
  meta.json            generation time and counts
  buyer.json           buyer profile from config/buyer.yaml
  catalogue.json       one summary per series: metadata, explainer, latest value, change, percentile
  series/<id>.json     observations, plus year-over-year percent change for index series
  trreb.json           TRREB district rows and HPI benchmark rows (personal use, do not publish)
"""

from __future__ import annotations

import json
from bisect import bisect_right
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import duckdb
import yaml

from ingest import db
from ingest.models import SeriesDef

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "app" / "public" / "data"
BUYER_CONFIG = ROOT / "config" / "buyer.yaml"

# Toronto geography rows worth exporting from the TRREB tables.
TRREB_AREA_SQL = "(area LIKE 'Toronto %' OR area IN ('City of Toronto', 'All TRREB Areas'))"


def is_index(series: SeriesDef) -> bool:
    return series.unit.lower().startswith("index")


def yoy_series(obs: list[tuple[date, float]]) -> list[tuple[date, float]]:
    """Percent change versus the observation closest to one year earlier (within 20 days)."""
    dates = [d for d, _ in obs]
    out: list[tuple[date, float]] = []
    for d, v in obs:
        target = (
            d.replace(year=d.year - 1)
            if not (d.month == 2 and d.day == 29)
            else d.replace(year=d.year - 1, day=28)
        )
        i = bisect_right(dates, target) - 1
        if i < 0 or abs((dates[i] - target).days) > 20 or obs[i][1] == 0:
            continue
        out.append((d, round((v / obs[i][1] - 1) * 100, 4)))
    return out


def percentile_rank(values: list[float], latest: float) -> float:
    """Share of all observations at or below the latest value, 0 to 100."""
    if not values:
        return float("nan")
    return round(100 * sum(1 for v in values if v <= latest) / len(values), 1)


def _summary(
    series: SeriesDef,
    obs: list[tuple[date, float]],
    today: date,
    yoy: list[tuple[date, float]] | None,
) -> dict:
    latest_date, latest = obs[-1]
    change = None
    if not is_index(series):
        dates = [d for d, _ in obs]
        target = latest_date - timedelta(days=365)
        i = bisect_right(dates, target) - 1
        if i >= 0 and abs((dates[i] - target).days) <= 20:
            change = round(latest - obs[i][1], 4)
    return {
        **json.loads(series.model_dump_json(exclude={"explainer"})),
        "explainer": series.explainer.model_dump() if series.explainer else None,
        "first_obs": obs[0][0].isoformat(),
        "n_obs": len(obs),
        "latest": {"date": latest_date.isoformat(), "value": latest},
        "stale_days": (today - latest_date).days,
        "change_1y_abs": change,
        "yoy_pct": yoy[-1][1] if yoy else None,
        "percentile": percentile_rank([v for _, v in obs], latest),
    }


def export(
    conn: duckdb.DuckDBPyConnection,
    catalogue: list[SeriesDef],
    out_dir: Path = DEFAULT_OUT,
    today: date | None = None,
) -> dict:
    today = today or date.today()
    (out_dir / "series").mkdir(parents=True, exist_ok=True)
    summaries = []
    for s in catalogue:
        rows = conn.execute(
            "SELECT obs_date, value FROM observation WHERE series_id = ? ORDER BY obs_date", [s.id]
        ).fetchall()
        if not rows:
            continue
        obs = [(d, float(v)) for d, v in rows]
        yoy = yoy_series(obs) if is_index(s) else None
        payload = {
            "id": s.id,
            "obs": [[d.isoformat(), v] for d, v in obs],
            "yoy": [[d.isoformat(), v] for d, v in yoy] if yoy is not None else None,
        }
        (out_dir / "series" / f"{s.id}.json").write_text(json.dumps(payload, separators=(",", ":")))
        summaries.append(_summary(s, obs, today, yoy))
    (out_dir / "catalogue.json").write_text(json.dumps(summaries, indent=1))

    buyer = yaml.safe_load(BUYER_CONFIG.read_text(encoding="utf-8"))
    (out_dir / "buyer.json").write_text(json.dumps(buyer, indent=1))

    trreb = _trreb_payload(conn)
    (out_dir / "trreb.json").write_text(json.dumps(trreb, separators=(",", ":")))

    meta = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "series": len(summaries),
        "trreb_rows": len(trreb["market"]),
        "hpi_rows": len(trreb["hpi"]),
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=1))
    return meta


def _trreb_payload(conn: duckdb.DuckDBPyConnection) -> dict:
    market_cols = ["period", "area", "home_type", *db.TRREB_FIELDS]
    market = conn.execute(
        f"SELECT {', '.join(market_cols)} FROM trreb_monthly WHERE {TRREB_AREA_SQL} "
        "ORDER BY period, area, home_type"
    ).fetchall()
    hpi = conn.execute(
        f"SELECT period, area, home_type, idx, benchmark, yoy_pct FROM trreb_hpi "
        f"WHERE {TRREB_AREA_SQL} ORDER BY period, area, home_type"
    ).fetchall()

    def clean(row):
        return [v.isoformat() if isinstance(v, date) else v for v in row]

    return {
        "market_columns": market_cols,
        "market": [clean(r) for r in market],
        "hpi_columns": ["period", "area", "home_type", "index", "benchmark", "yoy_pct"],
        "hpi": [clean(r) for r in hpi],
    }
