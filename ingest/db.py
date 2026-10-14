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
