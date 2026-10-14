from __future__ import annotations

from datetime import date

import httpx

from ingest.models import Observation, SeriesDef

BASE_URL = "https://www.bankofcanada.ca/valet/observations"


def fetch(series: SeriesDef, client: httpx.Client, since: date | None = None) -> list[Observation]:
    """Fetch observations for one Valet series. No API key is needed."""
    params = {"start_date": since.isoformat()} if since else {}
    resp = client.get(f"{BASE_URL}/{series.source_id}/json", params=params)
    resp.raise_for_status()
    return parse(resp.json(), series.source_id)


def parse(payload: dict, source_id: str) -> list[Observation]:
    """Valet rows look like {"d": "2026-10-13", "V39079": {"v": "2.25"}}. Blanks are skipped."""
    out: list[Observation] = []
    for row in payload.get("observations", []):
        raw = (row.get(source_id) or {}).get("v")
        if raw in (None, ""):
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        out.append(Observation(obs_date=date.fromisoformat(row["d"]), value=value))
    return out
