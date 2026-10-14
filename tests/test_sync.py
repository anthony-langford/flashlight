from datetime import date, timedelta

import httpx

from ingest import db
from ingest.models import Observation, SeriesDef, Source
from ingest.sync import REVISION_LOOKBACK, sync


def _series(sid: str, source: str = "boc_valet") -> SeriesDef:
    return SeriesDef.model_validate(
        {
            "id": sid,
            "title": sid,
            "source": source,
            "source_id": "X",
            "frequency": "daily",
            "unit": "percent",
            "geography": "Canada",
            "layer": "rates_credit",
        }
    )


def _obs(*pairs):
    return [Observation(obs_date=d, value=v) for d, v in pairs]


def test_sync_is_idempotent_and_upserts():
    conn = db.connect(":memory:")
    calls = []

    def fetch(series, client, since):
        calls.append(since)
        return _obs((date(2026, 1, 1), 1.0), (date(2026, 1, 2), 2.0))

    with httpx.Client() as client:
        sync(conn, [_series("a.one")], client, fetchers={Source.BOC_VALET: fetch})
        sync(conn, [_series("a.one")], client, fetchers={Source.BOC_VALET: fetch})
    count = conn.execute("SELECT count(*) FROM observation").fetchone()[0]
    assert count == 2
    # first run is a full fetch, second is incremental from last obs minus the lookback
    assert calls[0] is None
    assert calls[1] == date(2026, 1, 2) - REVISION_LOOKBACK


def test_revised_value_replaces_old():
    conn = db.connect(":memory:")
    day = date(2026, 3, 1)
    batches = iter([_obs((day, 1.0)), _obs((day, 1.5))])

    def fetch(series, client, since):
        return next(batches)

    with httpx.Client() as client:
        sync(conn, [_series("a.one")], client, fetchers={Source.BOC_VALET: fetch})
        sync(conn, [_series("a.one")], client, fetchers={Source.BOC_VALET: fetch})
    assert conn.execute("SELECT value FROM observation").fetchone()[0] == 1.5


def test_full_flag_ignores_stored_history():
    conn = db.connect(":memory:")
    seen = []

    def fetch(series, client, since):
        seen.append(since)
        return _obs((date(2026, 1, 1), 1.0))

    with httpx.Client() as client:
        sync(conn, [_series("a.one")], client, fetchers={Source.BOC_VALET: fetch})
        sync(conn, [_series("a.one")], client, full=True, fetchers={Source.BOC_VALET: fetch})
    assert seen == [None, None]


def test_one_failure_does_not_stop_others():
    conn = db.connect(":memory:")

    def fetch(series, client, since):
        if series.id == "a.bad":
            raise RuntimeError("boom")
        return _obs((date(2026, 1, 1), 1.0))

    with httpx.Client() as client:
        result = sync(
            conn,
            [_series("a.bad"), _series("a.good")],
            client,
            fetchers={Source.BOC_VALET: fetch},
        )
    assert result == {"a.bad": "error", "a.good": "ok"}
    statuses = dict(conn.execute("SELECT series_id, status FROM fetch_log").fetchall())
    assert statuses == {"a.bad": "error", "a.good": "ok"}


def test_unknown_source_is_skipped():
    conn = db.connect(":memory:")
    with httpx.Client() as client:
        result = sync(conn, [_series("a.fred", "fred")], client, fetchers={})
    assert result == {"a.fred": "skipped"}


def test_lookback_is_a_window_not_zero():
    assert REVISION_LOOKBACK > timedelta(0)


def _run_one(fetch):
    conn = db.connect(":memory:")
    sleeps = []
    with httpx.Client() as client:
        result = sync(
            conn,
            [_series("a.one")],
            client,
            fetchers={Source.BOC_VALET: fetch},
            sleep=sleeps.append,
        )
    return result, sleeps


def test_transient_error_is_retried_then_succeeds():
    attempts = []

    def fetch(series, client, since):
        attempts.append(1)
        if len(attempts) < 3:
            raise httpx.ConnectTimeout("handshake timed out")
        return _obs((date(2026, 1, 1), 1.0))

    result, sleeps = _run_one(fetch)
    assert result == {"a.one": "ok"}
    assert len(attempts) == 3
    assert sleeps == [1, 2]


def test_client_error_is_not_retried():
    attempts = []

    def fetch(series, client, since):
        attempts.append(1)
        request = httpx.Request("GET", "https://example.com")
        raise httpx.HTTPStatusError("nope", request=request, response=httpx.Response(404))

    result, sleeps = _run_one(fetch)
    assert result == {"a.one": "error"}
    assert len(attempts) == 1
    assert sleeps == []


def test_server_error_exhausts_attempts_then_fails():
    attempts = []

    def fetch(series, client, since):
        attempts.append(1)
        request = httpx.Request("GET", "https://example.com")
        raise httpx.HTTPStatusError("boom", request=request, response=httpx.Response(503))

    result, _ = _run_one(fetch)
    assert result == {"a.one": "error"}
    assert len(attempts) == 3
