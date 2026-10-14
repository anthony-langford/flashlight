"""TRREB Market Watch PDF parser (personal use only; TRREB content is copyrighted).

The monthly PDFs contain, per home type, an "ALL TRREB AREAS" table and a "City of Toronto
Municipal Breakdown" table with one row per area or district (for example "Toronto E01").
We parse the monthly tables only. Year-to-date tables are skipped, they can be derived.
"""

from __future__ import annotations

import logging
import re
import subprocess
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

PDF_URL = "https://trreb.ca/wp-content/files/market-stats/market-watch/mw{yy:02d}{mm:02d}.pdf"
DEFAULT_PDF_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "trreb"

HOME_TYPES = {
    "All Home types": "all",
    "Detached": "detached",
    "Semi-Detached": "semi_detached",
    "Att/Row/Townhouse": "att_row_townhouse",
    "Condo Townhouse": "condo_townhouse",
    "Condo Apartment": "condo_apartment",
    "Link": "link",
    "Co-Op Apartment": "co_op_apartment",
    "Detached Condo": "detached_condo",
    "Co-Ownership Apartment": "co_ownership_apartment",
}

COLUMNS = {
    "Sales": "sales",
    "Dollar Volume": "dollar_volume",
    "Average Price": "avg_price",
    "Median Price": "median_price",
    "New Listings": "new_listings",
    "SNLR Trend": "snlr_trend",
    "Active Listings": "active_listings",
    "Mos Inv (Trend)": "months_inventory",
    "Avg. SP/LP": "sp_lp",
    "Avg. LDOM": "ldom",
    "Avg. PDOM": "pdom",
}
# Columns that are blank when a row has zero sales.
BLANK_WHEN_NO_SALES = {"dollar_volume", "avg_price", "median_price", "sp_lp", "ldom", "pdom"}
INT_FIELDS = {"sales", "new_listings", "active_listings"}

MONTHS = {
    m: i
    for i, m in enumerate(
        [
            "January", "February", "March", "April", "May", "June", "July",
            "August", "September", "October", "November", "December",
        ],
        start=1,
    )
}  # fmt: skip

_SECTION = re.compile(
    r"^(?P<table>ALL TRREB AREAS|City of Toronto Municipal Breakdown)\s{2,}"
    r"(?P<type>.+?), (?P<period>[A-Za-z-]+) (?P<year>\d{4})\s*$"
)
_NUMERIC = re.compile(r"^[\$\d][\d,\.]*%?$|^-?\d[\d,\.]*%?$")


@dataclass(frozen=True)
class DistrictRow:
    period: date
    area: str
    home_type: str
    values: dict[str, float | None]


def _num(token: str) -> float:
    return float(token.replace("$", "").replace(",", "").replace("%", ""))


def _split_row(line: str) -> tuple[str, list[str]] | None:
    tokens = line.split()
    for i, tok in enumerate(tokens):
        if _NUMERIC.match(tok):
            if i == 0:
                return None
            return " ".join(tokens[:i]), tokens[i:]
    return None


def _columns_from_header(line: str) -> list[str] | None:
    parts = re.split(r"\s{2,}", line.strip())
    cols = [COLUMNS[p] for p in parts[1:] if p in COLUMNS]
    return cols if len(cols) == len(parts) - 1 and "sales" in cols else None


def parse_text(text: str) -> list[DistrictRow]:
    """Parse monthly district rows from `pdftotext -layout` output."""
    rows: list[DistrictRow] = []
    section: tuple[str, date] | None = None  # (home_type, period)
    columns: list[str] | None = None
    skipped = 0
    for line in text.splitlines():
        m = _SECTION.match(line)
        if m:
            home_type = HOME_TYPES.get(m["type"].strip())
            month = MONTHS.get(m["period"])
            # Year-to-date headings have no month, and unknown types are ignored.
            section = (home_type, date(int(m["year"]), month, 1)) if home_type and month else None
            columns = None
            continue
        if section is None:
            continue
        if line.startswith("Copyright"):
            section, columns = None, None
            continue
        if columns is None:
            columns = _columns_from_header(line)
            continue
        split = _split_row(line)
        if split is None:
            continue
        name, tokens = split
        if name in {"AreaDerived", "MunicipalityDerived"}:
            continue
        values = _map_values(columns, tokens)
        if values is None:
            skipped += 1
            log.warning("skipping unparseable row in %s: %r", section, line.strip()[:100])
            continue
        rows.append(DistrictRow(section[1], name, section[0], values))
    if skipped:
        log.warning("%d rows skipped", skipped)
    return rows


def _map_values(columns: list[str], tokens: list[str]) -> dict[str, float | None] | None:
    if len(tokens) == len(columns):
        return dict(zip(columns, (_num(t) for t in tokens), strict=True))
    # Rows with no sales leave price and days-on-market cells blank, so tokens shift left.
    if tokens and _num(tokens[0]) == 0:
        present = [c for c in columns if c not in BLANK_WHEN_NO_SALES]
        if len(tokens) == len(present):
            values: dict[str, float | None] = {c: None for c in columns}
            values.update(zip(present, (_num(t) for t in tokens), strict=True))
            return values
    return None


def pdf_path(year: int, month: int, directory: Path = DEFAULT_PDF_DIR) -> Path:
    return directory / f"mw{year % 100:02d}{month:02d}.pdf"


def download(
    client: httpx.Client, year: int, month: int, directory: Path = DEFAULT_PDF_DIR
) -> Path | None:
    """Download one Market Watch PDF if not already cached. Returns None if TRREB has none."""
    path = pdf_path(year, month, directory)
    if path.exists():
        return path
    resp = client.get(PDF_URL.format(yy=year % 100, mm=month), follow_redirects=True)
    if resp.status_code == 404 or "pdf" not in resp.headers.get("content-type", ""):
        return None
    resp.raise_for_status()
    directory.mkdir(parents=True, exist_ok=True)
    path.write_bytes(resp.content)
    return path


def pdf_to_text(path: Path) -> str:
    """Extract text with poppler's pdftotext (install with `brew install poppler`)."""
    result = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout
