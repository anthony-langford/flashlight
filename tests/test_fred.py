from datetime import date

import httpx
import pytest
import respx

from ingest.config import load_env, redact
from ingest.models import SeriesDef
from ingest.sources import fred

FAKE_KEY = "abc123notarealkey"


def _series() -> SeriesDef:
    return SeriesDef.model_validate(
        {
            "id": "fred.ust_10y",
            "title": "10y",
            "source": "fred",
            "source_id": "DGS10",
            "frequency": "daily",
            "unit": "percent",
            "geography": "United States",
            "layer": "us_inputs",
        }
    )


def test_parse_skips_missing_markers():
    payload = {
        "observations": [
            {"date": "2026-10-08", "value": "."},
            {"date": "2026-10-09", "value": "5.24"},
        ]
    }
    obs = fred.parse(payload)
    assert [(o.obs_date, o.value) for o in obs] == [(date(2026, 10, 9), 5.24)]


@respx.mock
def test_fetch_sends_key_and_start(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", FAKE_KEY)
    route = respx.get(fred.BASE_URL).mock(
        return_value=httpx.Response(200, json={"observations": []})
    )
    with httpx.Client() as client:
        fred.fetch(_series(), client, since=date(2026, 9, 1))
    params = route.calls.last.request.url.params
    assert params["series_id"] == "DGS10"
    assert params["api_key"] == FAKE_KEY
    assert params["observation_start"] == "2026-09-01"


def test_fetch_requires_key(monkeypatch):
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    with httpx.Client() as client, pytest.raises(RuntimeError, match="FRED_API_KEY"):
        fred.fetch(_series(), client)


@respx.mock
def test_http_error_message_does_not_leak_key(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", FAKE_KEY)
    respx.get(fred.BASE_URL).mock(return_value=httpx.Response(400, json={}))
    with httpx.Client() as client, pytest.raises(RuntimeError) as err:
        fred.fetch(_series(), client)
    assert FAKE_KEY not in str(err.value)


def test_redact_strips_key_from_urls():
    url = f"https://api.stlouisfed.org/fred/series/observations?series_id=X&api_key={FAKE_KEY}&file_type=json"
    cleaned = redact(f"Client error for url '{url}'")
    assert FAKE_KEY not in cleaned
    assert "api_key=REDACTED" in cleaned


def test_load_env_does_not_override(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("# comment\nFRED_API_KEY=fromfile\nOTHER='quoted'\n")
    monkeypatch.setenv("FRED_API_KEY", "already")
    monkeypatch.delenv("OTHER", raising=False)
    load_env(env)
    import os

    assert os.environ["FRED_API_KEY"] == "already"
    assert os.environ["OTHER"] == "quoted"
