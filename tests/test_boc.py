import json
from datetime import date
from pathlib import Path

import httpx
import respx

from ingest.models import SeriesDef
from ingest.sources import boc

FIXTURE = Path(__file__).parent / "fixtures" / "boc_V39079.json"


def _series() -> SeriesDef:
    return SeriesDef.model_validate(
        {
            "id": "boc.policy_rate",
            "title": "Policy rate",
            "source": "boc_valet",
            "source_id": "V39079",
            "frequency": "daily",
            "unit": "percent",
            "geography": "Canada",
            "layer": "rates_credit",
        }
    )


def test_parse_fixture():
    payload = json.loads(FIXTURE.read_text())
    obs = boc.parse(payload, "V39079")
    assert len(obs) == 3
    assert obs[0].obs_date == date(2026, 10, 13)
    assert obs[0].value == 2.25


def test_parse_skips_blank_and_bad_values():
    payload = {
        "observations": [
            {"d": "2026-01-01", "X": {"v": ""}},
            {"d": "2026-01-02", "X": {"v": "n/a"}},
            {"d": "2026-01-03"},
            {"d": "2026-01-04", "X": {"v": "1.5"}},
        ]
    }
    obs = boc.parse(payload, "X")
    assert [o.value for o in obs] == [1.5]


@respx.mock
def test_fetch_passes_start_date():
    route = respx.get(f"{boc.BASE_URL}/V39079/json").mock(
        return_value=httpx.Response(200, json=json.loads(FIXTURE.read_text()))
    )
    with httpx.Client() as client:
        obs = boc.fetch(_series(), client, since=date(2026, 9, 1))
    assert len(obs) == 3
    assert route.calls.last.request.url.params["start_date"] == "2026-09-01"


@respx.mock
def test_fetch_without_since_sends_no_params():
    route = respx.get(f"{boc.BASE_URL}/V39079/json").mock(
        return_value=httpx.Response(200, json={"observations": []})
    )
    with httpx.Client() as client:
        assert boc.fetch(_series(), client) == []
    assert "start_date" not in route.calls.last.request.url.params
