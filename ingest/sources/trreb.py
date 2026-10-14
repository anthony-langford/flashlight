"""TRREB Market Watch PDF parser (personal use only; TRREB content is copyrighted).

The monthly PDFs contain, per home type, an "ALL TRREB AREAS" table and a "City of Toronto
Municipal Breakdown" table with one row per area or district (for example "Toronto E01").
We parse the monthly tables only. Year-to-date tables are skipped, they can be derived.
"""

from __future__ import annotations

import html
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


# --- MLS Home Price Index (HPI) benchmark pages -------------------------------------------------
# Rows can lack whole home-type groups (for example no townhouse benchmark in a district), so
# text order is ambiguous. We assign each number to a group by its x position instead.

HPI_TYPES = ["composite", "sf_detached", "sf_attached", "townhouse", "apartment"]

_WORD = re.compile(
    r'<word xMin="(?P<x0>[\d.]+)" yMin="(?P<y0>[\d.]+)" '
    r'xMax="[\d.]+" yMax="[\d.]+">(?P<t>.*?)</word>'
)
# Two wordings: "MLS Home Price Index ... City of Toronto, September 2026" (Sept 2026 layout) and
# "Index and Benchmark Price, August 2026" (earlier layout).
_HPI_TITLE = re.compile(
    r"(?:Home Price Index.*?|Index and Benchmark Price), (?P<month>[A-Za-z]+) (?P<year>\d{4})\s*$"
)


@dataclass(frozen=True)
class HpiRow:
    period: date
    area: str
    home_type: str
    index: float
    benchmark: float
    yoy_pct: float


def pdf_to_bbox(path: Path) -> str:
    """Word positions for every page, as poppler's bbox HTML."""
    result = subprocess.run(
        ["pdftotext", "-bbox", str(path), "-"], capture_output=True, text=True, check=True
    )
    return result.stdout


def _page_lines(page_html: str) -> list[list[tuple[float, str]]]:
    """Group words into lines by y position. Each line is [(x, text), ...] sorted by x."""
    words = sorted(
        (float(m["y0"]), float(m["x0"]), html.unescape(m["t"])) for m in _WORD.finditer(page_html)
    )
    lines: list[tuple[float, list[tuple[float, str]]]] = []
    for y, x, text in words:
        if lines and abs(lines[-1][0] - y) <= 2.5:
            lines[-1][1].append((x, text))
        else:
            lines.append((y, [(x, text)]))
    return [sorted(ws) for _, ws in lines]


def _group_starts(lines: list[list[tuple[float, str]]]) -> list[float]:
    # A header row has one "Benchmark" per home-type group. Page titles can also contain both
    # "Index" and "Benchmark" (for example "Index and Benchmark Price, September 2025"), so a
    # single "Benchmark" does not make a header.
    xs = sorted(
        {
            x
            for line in lines
            if sum(t == "Benchmark" for _, t in line) >= 3
            for x, t in line
            if t == "Index"
        }
    )
    starts: list[float] = []
    for x in xs:
        if not starts or x - starts[-1] > 20:
            starts.append(x)
    return starts


def parse_hpi(bbox_html: str) -> list[HpiRow]:
    """Parse benchmark rows from `pdftotext -bbox` output of a Market Watch PDF."""
    rows: list[HpiRow] = []
    for page in bbox_html.split("<page ")[1:]:
        lines = _page_lines(page)
        period: date | None = None
        for line in lines:
            m = _HPI_TITLE.search(" ".join(t for _, t in line))
            if m and m["month"] in MONTHS:
                period = date(int(m["year"]), MONTHS[m["month"]], 1)
        if period is None:
            continue
        starts = _group_starts(lines)
        if len(starts) != len(HPI_TYPES):
            log.warning("HPI page has %d column groups, expected %d", len(starts), len(HPI_TYPES))
            continue
        for line in lines:
            first_num = next((i for i, (_, t) in enumerate(line) if _NUMERIC.match(t)), None)
            if not first_num:
                continue
            area = " ".join(t for _, t in line[:first_num])
            nums = line[first_num:]
            if len(nums) < 3:
                continue
            groups: dict[int, list[float]] = {}
            for x, t in nums:
                g = max((i for i, s in enumerate(starts) if x >= s - 15), default=None)
                if g is None:
                    break
                groups.setdefault(g, []).append(_num(t))
            else:
                for g, vals in groups.items():
                    if len(vals) == 3:
                        rows.append(HpiRow(period, area, HPI_TYPES[g], *vals))
    return rows


# --- Older sales-table layout (before September 2026) --------------------------------------------
# In those PDFs every table row is drawn twice: once at its own position and once again, with the
# same text at the same x position, in the next row's slot. So the words in slot N are row N plus a
# copy of row N-1, and row N is slot N minus a copy of row N-1. Plain text extraction scrambles
# this, so we work from word positions. Every recovered row must pass an arithmetic check
# (average price is dollar volume divided by sales) or it is dropped.

_OLD_TITLE = re.compile(
    r"SUMMARY OF EXISTING HOME TRANSACTIONS\s+"
    r"(?P<type>.+?), (?P<month>[A-Za-z-]+) (?P<year>\d{4})\s*$"
)
_HOME_TYPES_LOWER = {k.lower(): v for k, v in HOME_TYPES.items()}
_GHOST_NOISE = {"Abc"}
_MAX_PRICE_MISMATCH = 0.01


def _page_slots(page_html: str) -> list[list[tuple[float, str]]]:
    """Words grouped into row slots by y position (ghost copies land in the next row's slot)."""
    words = sorted(
        (float(m["y0"]), float(m["x0"]), html.unescape(m["t"])) for m in _WORD.finditer(page_html)
    )
    slots: list[tuple[float, list[tuple[float, str]]]] = []
    for y, x, text in words:
        if text in _GHOST_NOISE:
            continue
        if slots and abs(slots[-1][0] - y) <= 3.0:
            slots[-1][1].append((x, text))
        else:
            slots.append((y, [(x, text)]))
    return [sorted(ws) for _, ws in slots]


def _old_columns(slot: list[tuple[float, str]]) -> list[tuple[float, str]] | None:
    """(x, field) for each column in a header slot like 'Sales Dollar Volume Average Price ...'."""
    words = list(slot)
    names = sorted(COLUMNS, key=lambda n: -len(n.split()))
    cols: list[tuple[float, str]] = []
    i = 0
    while i < len(words):
        for name in names:
            n = len(name.split())
            if " ".join(t for _, t in words[i : i + n]) == name:
                cols.append((words[i][0], COLUMNS[name]))
                i += n
                break
        else:
            return None
    return cols if cols and cols[0][1] == "sales" else None


def _column_for(x: float, cols: list[tuple[float, str]]) -> str | None:
    """The column whose header starts at or just left of x (values sit under or right of it)."""
    best = None
    for cx, field in cols:
        if x >= cx - 6:
            best = field
    return best


def _remove_copy(
    slot: list[tuple[float, str]], previous: list[tuple[float, str]]
) -> tuple[list[tuple[float, str]], list[tuple[float, str]]]:
    """Remove one copy of each of the previous row's words from this slot.

    Returns (remaining words, removed words). Identical text at an identical position can be
    collapsed into one word by the extractor, so a row may also be missing a word it really has.
    """
    remaining = list(slot)
    removed: list[tuple[float, str]] = []
    for px, pt in previous:
        for i, (x, t) in enumerate(remaining):
            if t == pt and abs(x - px) < 0.6:
                removed.append(remaining.pop(i))
                break
    return remaining, removed


def _fill_collapsed(
    own: list[tuple[float, str]],
    removed: list[tuple[float, str]],
    *,
    below: float | None = None,
    at_or_above: float | None = None,
) -> list[tuple[float, str]]:
    """Add back removed words at positions where the row has no word of its own.

    `below` limits this to positions left of an x value (the name area), `at_or_above` to positions
    from an x value rightward (the numeric columns).
    """
    out = list(own)
    for rx, rt in removed:
        if below is not None and rx >= below:
            continue
        if at_or_above is not None and rx < at_or_above:
            continue
        if not any(abs(x - rx) < 0.6 for x, _ in out):
            out.append((rx, rt))
    return sorted(out)


# Columns that anchor the arithmetic check. If two words compete for one of these the row is lost.
_KEY_FIELDS = {"sales", "dollar_volume", "avg_price"}


def _row_values(
    own: list[tuple[float, str]], cols: list[tuple[float, str]]
) -> tuple[dict[str, float | None], set[str]]:
    """Map a row's numbers to columns. Returns (values, fields where two words competed)."""
    values: dict[str, float | None] = {c: None for _, c in cols}
    seen: set[str] = set()
    conflicts: set[str] = set()
    for x, t in own:
        if not _NUMERIC.match(t):
            continue
        field = _column_for(x, cols)
        if field is None:
            continue
        if field in seen:
            conflicts.add(field)
            values[field] = None
            continue
        seen.add(field)
        values[field] = _num(t)
    return values, conflicts


def _usable(values: dict[str, float | None], conflicts: set[str]) -> dict[str, float | None] | None:
    """Apply the checks. Competing words in a non-key column leave that column unknown."""
    if conflicts & _KEY_FIELDS:
        return None
    if values.get("sales") == 0:
        # A zero-sales row has blank price cells, and any other word in the slot is likely a
        # leftover copy of the previous row, so keep only the sales count.
        return {k: (0.0 if k == "sales" else None) for k in values}
    return values if _row_is_consistent(values) else None


def parse_old_layout(bbox_html: str) -> list[DistrictRow]:
    """District rows from the older Market Watch layout. Rows that fail the checks are dropped."""
    out: list[DistrictRow] = []
    dropped = 0
    for page in bbox_html.split("<page ")[1:]:
        meta: tuple[str, date] | None = None
        cols: list[tuple[float, str]] | None = None
        previous: list[tuple[float, str]] = []
        for slot in _page_slots(page):
            text = " ".join(t for _, t in slot)
            m = _OLD_TITLE.search(text)
            if m:
                ht = _HOME_TYPES_LOWER.get(m["type"].strip().lower())
                month = MONTHS.get(m["month"])
                meta = (ht, date(int(m["year"]), month, 1)) if ht and month else None
                cols, previous = None, []
                continue
            if meta is None:
                continue
            if cols is None:
                cols = _old_columns(slot)
                continue
            name_limit = cols[0][0] - 20
            own, removed = _remove_copy(slot, previous)
            # Only the first word of a name ("Toronto" repeated down the page) is realistically
            # collapsed with the previous row's identical copy.
            start_x = min((x for x, _ in slot if x < name_limit), default=0.0)
            own = _fill_collapsed(own, removed, below=start_x + 1.0)
            previous_row = list(own)
            name = " ".join(t for x, t in own if x < name_limit)
            if not name or not any(_NUMERIC.match(t) for _, t in own):
                previous = previous_row
                continue
            raw, conflicts = _row_values(own, cols)
            values = _usable(raw, conflicts)
            # A numeric value equal to the previous row's may have been collapsed away. Rows with
            # sales have every cell filled, so restore gaps there too.
            if values is None or values.get("sales", 0) > 0:
                retry = _fill_collapsed(own, removed, at_or_above=name_limit)
                raw2, conflicts2 = _row_values(retry, cols)
                retry_values = _usable(raw2, conflicts2)
                if retry_values is not None:
                    values, own = retry_values, retry
            previous = list(own)
            if values is None:
                dropped += 1
                log.debug("dropped %s (%s, %s)", name, meta[0], meta[1])
                continue
            out.append(DistrictRow(meta[1], name, meta[0], values))
    if dropped:
        log.warning("%d old-layout rows failed the consistency checks and were dropped", dropped)
    return out


def _row_is_consistent(v: dict[str, float | None]) -> bool:
    """Sales must be present, and average price must equal dollar volume divided by sales."""
    sales, volume, avg = v.get("sales"), v.get("dollar_volume"), v.get("avg_price")
    if sales is None:
        return False
    if sales == 0:
        return avg is None and volume is None
    if volume is None or avg is None or avg == 0:
        return False
    return abs(volume / sales / avg - 1) <= _MAX_PRICE_MISMATCH
