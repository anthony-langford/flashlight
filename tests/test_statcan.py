import json
from datetime import date
from pathlib import Path

import httpx
import pytest
import respx

from ingest.models import Frequency, SeriesDef
from ingest.sources import statcan

FIXTURE = Path(__file__).parent / "fixtures" / "statcan_two_vectors.json"
STARTS_VECTOR = 42127475
UNEMPLOYMENT_VECTOR = 1643279334


def _series(vector: int = STARTS_VECTOR, frequency: str = "monthly") -> SeriesDef:
    return SeriesDef.model_validate(
        {
            "id": "statcan.toronto.housing_starts_total",
            "title": "starts",
            "source": "statcan",
            "source_id": str(vector),
            "frequency": frequency,
            "unit": "units",
            "geography": "Toronto CMA",
            "layer": "supply",
        }
    )


def _payload():
    return json.loads(FIXTURE.read_text())


def test_parse_picks_the_requested_vector():
    starts = statcan.parse(_payload(), STARTS_VECTOR)
    unemployment = statcan.parse(_payload(), UNEMPLOYMENT_VECTOR)
    assert [o.obs_date for o in starts] == [date(2026, 6, 1), date(2026, 7, 1), date(2026, 8, 1)]
    assert [o.value for o in starts] == [2132.0, 1540.0, 1192.0]
    assert [o.value for o in unemployment] == [6.8, 6.8, 6.9]


def test_parse_is_independent_of_response_order():
    reordered = list(reversed(_payload()))
    assert statcan.parse(reordered, STARTS_VECTOR) == statcan.parse(_payload(), STARTS_VECTOR)


def test_parse_missing_vector_raises():
    with pytest.raises(ValueError, match="no entry for vector"):
        statcan.parse(_payload(), 999)


def test_parse_failed_status_raises():
    payload = _payload()
    payload[0]["object"]["responseStatusCode"] = 2
    with pytest.raises(ValueError, match="status 2"):
        statcan.parse(payload, payload[0]["object"]["vectorId"])


def test_parse_skips_suppressed_and_missing_values():
    payload = [
        {
            "status": "SUCCESS",
            "object": {
                "responseStatusCode": 0,
                "vectorId": 1,
                "vectorDataPoint": [
                    {"refPer": "2026-01-01", "value": None, "securityLevelCode": 0},
                    {"refPer": "2026-02-01", "value": "5", "securityLevelCode": 1},
                    {"refPer": "2026-03-01", "value": "7.5", "securityLevelCode": 0},
                ],
            },
        }
    ]
    assert [o.value for o in statcan.parse(payload, 1)] == [7.5]


def test_latest_n_full_history_and_windowed():
    assert statcan.latest_n(Frequency.MONTHLY, None) == statcan.FULL_HISTORY_N
    today = date(2026, 10, 14)
    # 45 days back on a monthly series needs about 2 periods, plus a margin, floored at 6
    assert statcan.latest_n(Frequency.MONTHLY, date(2026, 8, 30), today) == 6
    assert statcan.latest_n(Frequency.MONTHLY, date(2020, 10, 14), today) > 70
    assert statcan.latest_n(Frequency.ANNUAL, date(2020, 10, 14), today) == 9


@respx.mock
def test_fetch_posts_vector_and_latest_n():
    route = respx.post(statcan.URL).mock(return_value=httpx.Response(200, json=_payload()))
    with httpx.Client() as client:
        obs = statcan.fetch(_series(), client, since=None)
    assert len(obs) == 3
    body = json.loads(route.calls.last.request.content)
    assert body == [{"vectorId": STARTS_VECTOR, "latestN": statcan.FULL_HISTORY_N}]


@respx.mock
def test_fetch_accepts_v_prefixed_ids():
    respx.post(statcan.URL).mock(return_value=httpx.Response(200, json=_payload()))
    s = _series().model_copy(update={"source_id": f"v{STARTS_VECTOR}"})
    with httpx.Client() as client:
        assert len(statcan.fetch(s, client)) == 3


@respx.mock
def test_fetch_reports_locked_table():
    respx.post(statcan.URL).mock(return_value=httpx.Response(409))
    with httpx.Client() as client, pytest.raises(RuntimeError, match="locked for update"):
        statcan.fetch(_series(), client)
