from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from datetime import date, timedelta

import duckdb
import httpx

from ingest import db
from ingest.config import redact
from ingest.models import Observation, SeriesDef, Source
from ingest.sources import boc, fred

log = logging.getLogger(__name__)

Fetcher = Callable[[SeriesDef, httpx.Client, date | None], list[Observation]]

FETCHERS: dict[Source, Fetcher] = {
    Source.BOC_VALET: boc.fetch,
    Source.FRED: fred.fetch,
}

# Re-fetch a window before the last stored observation so late revisions are picked up.
REVISION_LOOKBACK = timedelta(days=45)


def sync(
    conn: duckdb.DuckDBPyConnection,
    series: Iterable[SeriesDef],
    client: httpx.Client,
    *,
    full: bool = False,
    fetchers: dict[Source, Fetcher] | None = None,
) -> dict[str, str]:
    """Fetch and upsert each series. A failure on one series is logged and does not stop the rest.

    Returns {series_id: "ok" | "error" | "skipped"}.
    """
    fetchers = fetchers if fetchers is not None else FETCHERS
    results: dict[str, str] = {}
    for s in series:
        fetch = fetchers.get(s.source)
        if fetch is None:
            results[s.id] = "skipped"
            continue
        db.upsert_series(conn, s)
        since = None
        if not full:
            last = db.last_obs_date(conn, s.id)
            since = last - REVISION_LOOKBACK if last else None
        try:
            observations = fetch(s, client, since)
        except Exception as exc:  # one bad series must not abort the run
            message = redact(str(exc))
            log.warning("fetch failed for %s: %s", s.id, message)
            db.log_fetch(conn, s.id, 0, "error", message[:500])
            results[s.id] = "error"
            continue
        db.upsert_observations(conn, s.id, observations)
        db.log_fetch(conn, s.id, len(observations), "ok")
        results[s.id] = "ok"
    return results
