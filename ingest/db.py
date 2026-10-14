from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path

import duckdb

from ingest.models import Observation, SeriesDef

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "flashlight.duckdb"

SCHEMA = """
CREATE TABLE IF NOT EXISTS series (
    series_id VARCHAR PRIMARY KEY,
    source VARCHAR NOT NULL,
    source_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    unit VARCHAR NOT NULL,
    frequency VARCHAR NOT NULL,
    geography VARCHAR NOT NULL,
    layer VARCHAR NOT NULL,
    seasonal_adj BOOLEAN
);
CREATE TABLE IF NOT EXISTS observation (
    series_id VARCHAR NOT NULL,
    obs_date DATE NOT NULL,
    value DOUBLE NOT NULL,
    PRIMARY KEY (series_id, obs_date)
);
CREATE TABLE IF NOT EXISTS trreb_monthly (
    period DATE NOT NULL,
    area VARCHAR NOT NULL,
    home_type VARCHAR NOT NULL,
    sales INTEGER,
    dollar_volume DOUBLE,
    avg_price DOUBLE,
    median_price DOUBLE,
    new_listings INTEGER,
    snlr_trend DOUBLE,
    active_listings INTEGER,
    months_inventory DOUBLE,
    sp_lp DOUBLE,
    ldom DOUBLE,
    pdom DOUBLE,
    PRIMARY KEY (period, area, home_type)
);
CREATE TABLE IF NOT EXISTS trreb_hpi (
    period DATE NOT NULL,
    area VARCHAR NOT NULL,
    home_type VARCHAR NOT NULL,
    idx DOUBLE,
    benchmark DOUBLE,
    yoy_pct DOUBLE,
    PRIMARY KEY (period, area, home_type)
);
CREATE TABLE IF NOT EXISTS fetch_log (
    series_id VARCHAR NOT NULL,
    fetched_at TIMESTAMP NOT NULL,
    rows_fetched INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    note VARCHAR
);
"""


def connect(path: Path | str = DEFAULT_DB_PATH) -> duckdb.DuckDBPyConnection:
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = duckdb.connect(str(path))
    conn.execute(SCHEMA)
    return conn


def upsert_series(conn: duckdb.DuckDBPyConnection, s: SeriesDef) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO series VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            s.id,
            s.source.value,
            s.source_id,
            s.title,
            s.unit,
            s.frequency.value,
            s.geography,
            s.layer.value,
            s.seasonal_adj,
        ],
    )


def upsert_observations(
    conn: duckdb.DuckDBPyConnection, series_id: str, observations: list[Observation]
) -> None:
    if not observations:
        return
    conn.executemany(
        "INSERT OR REPLACE INTO observation VALUES (?, ?, ?)",
        [[series_id, o.obs_date, o.value] for o in observations],
    )


def last_obs_date(conn: duckdb.DuckDBPyConnection, series_id: str) -> date | None:
    row = conn.execute(
        "SELECT max(obs_date) FROM observation WHERE series_id = ?", [series_id]
    ).fetchone()
    return row[0] if row else None


def log_fetch(
    conn: duckdb.DuckDBPyConnection, series_id: str, rows: int, status: str, note: str | None = None
) -> None:
    conn.execute(
        "INSERT INTO fetch_log VALUES (?, ?, ?, ?, ?)",
        [series_id, datetime.now(UTC).replace(tzinfo=None), rows, status, note],
    )


TRREB_FIELDS = [
    "sales", "dollar_volume", "avg_price", "median_price", "new_listings", "snlr_trend",
    "active_listings", "months_inventory", "sp_lp", "ldom", "pdom",
]  # fmt: skip


def upsert_trreb(conn: duckdb.DuckDBPyConnection, rows: list) -> None:
    """Upsert parsed TRREB district rows (ingest.sources.trreb.DistrictRow)."""
    if not rows:
        return
    placeholders = ", ".join("?" * (3 + len(TRREB_FIELDS)))
    conn.executemany(
        f"INSERT OR REPLACE INTO trreb_monthly VALUES ({placeholders})",
        [[r.period, r.area, r.home_type, *(r.values.get(f) for f in TRREB_FIELDS)] for r in rows],
    )


def upsert_hpi(conn: duckdb.DuckDBPyConnection, rows: list) -> None:
    """Upsert MLS HPI benchmark rows (ingest.sources.trreb.HpiRow)."""
    if not rows:
        return
    conn.executemany(
        "INSERT OR REPLACE INTO trreb_hpi VALUES (?, ?, ?, ?, ?, ?)",
        [[r.period, r.area, r.home_type, r.index, r.benchmark, r.yoy_pct] for r in rows],
    )
