from __future__ import annotations

from datetime import date, timedelta

import httpx

from ingest.models import Frequency, Observation, SeriesDef

URL = "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods"

# A very large latestN returns the full history (checked 2026-10-14: 656 points back to 1972).
FULL_HISTORY_N = 5000


def latest_n(frequency: Frequency, since: date | None, today: date | None = None) -> int:
    """How many most-recent periods to request so the window reaches back to `since`."""
    if since is None:
        return FULL_HISTORY_N
    days = max((today or date.today()) - since, timedelta(0)).days
    periods = {
        Frequency.DAILY: days,
        Frequency.WEEKLY: days // 7,
        Frequency.MONTHLY: days // 28,
        Frequency.QUARTERLY: days // 90,
        Frequency.ANNUAL: days // 365,
    }[frequency]
    return max(periods + 3, 6)


def fetch(series: SeriesDef, client: httpx.Client, since: date | None = None) -> list[Observation]:
    """Fetch one StatCan vector. `source_id` is the vector id (digits, a v prefix is fine)."""
    vector = int(series.source_id.lstrip("vV"))
    n = latest_n(series.frequency, since)
    resp = client.post(URL, json=[{"vectorId": vector, "latestN": n}])
    if resp.status_code == 409:
        raise RuntimeError("StatCan table is locked for update (midnight to 8:30 ET). Retry later.")
    resp.raise_for_status()
    return parse(resp.json(), vector)


def parse(payload: list[dict], vector: int) -> list[Observation]:
    """Pick the entry for `vector` (results are not guaranteed to be in request order)."""
    entry = next((e for e in payload if (e.get("object") or {}).get("vectorId") == vector), None)
    if entry is None:
        raise ValueError(f"StatCan response has no entry for vector {vector}")
    obj = entry["object"]
    if entry.get("status") != "SUCCESS" or obj.get("responseStatusCode") != 0:
        raise ValueError(f"StatCan returned status {obj.get('responseStatusCode')} for {vector}")
    out: list[Observation] = []
    for point in obj.get("vectorDataPoint", []):
        raw = point.get("value")
        # securityLevelCode 1 means suppressed, and a missing value means not available.
        if raw in (None, "") or point.get("securityLevelCode") == 1:
            continue
        out.append(Observation(obs_date=date.fromisoformat(point["refPer"]), value=float(raw)))
    return out
