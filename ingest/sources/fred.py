from __future__ import annotations

import os
from datetime import date

import httpx

from ingest.models import Observation, SeriesDef

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"


def fetch(series: SeriesDef, client: httpx.Client, since: date | None = None) -> list[Observation]:
    """Fetch observations for one FRED series. Needs FRED_API_KEY in the environment."""
    key = os.environ.get("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY is not set (copy .env.example to .env)")
    params = {"series_id": series.source_id, "api_key": key, "file_type": "json"}
    if since:
        params["observation_start"] = since.isoformat()
    resp = client.get(BASE_URL, params=params)
    if resp.is_error:
        # Do not use raise_for_status: its message includes the URL, which contains the key.
        raise RuntimeError(f"FRED returned HTTP {resp.status_code} for {series.source_id}")
    return parse(resp.json())


def parse(payload: dict) -> list[Observation]:
    """FRED rows look like {"date": "2026-10-09", "value": "5.24"}. A "." means missing."""
    out: list[Observation] = []
    for row in payload.get("observations", []):
        raw = row.get("value")
        if raw in (None, "", "."):
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        out.append(Observation(obs_date=date.fromisoformat(row["date"]), value=value))
    return out
