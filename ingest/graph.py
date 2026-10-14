"""Causal map: validated nodes and edges, plus a data check for each edge.

The edges are claims. The data check only asks whether the history is consistent with the claim.
It is not proof of causation, and with fewer than 5 years of overlap it declines to answer.
"""

from __future__ import annotations

import math
from datetime import date
from enum import StrEnum
from pathlib import Path
from typing import Literal

import duckdb
import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ingest.models import SeriesDef

GRAPH_DIR = Path(__file__).resolve().parent.parent / "graph"

MIN_OVERLAP_MONTHS = 60
MIN_ABS_CORR = 0.15


class Confidence(StrEnum):
    ESTABLISHED = "established"
    PLAUSIBLE = "plausible"
    DEBATED = "debated"


class Review(StrEnum):
    DRAFT = "draft"
    REVIEWED = "reviewed"


class TrrebRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["market", "hpi"]
    area: str
    home_type: str
    field: str | None = None  # a trreb_monthly column, for kind market


class Node(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9_]+$")
    label: str
    col: int
    row: float
    series: str | None = None
    trreb: TrrebRef | None = None

    @model_validator(mode="after")
    def one_source(self) -> Node:
        if self.series and self.trreb:
            raise ValueError(f"node {self.id}: use either series or trreb, not both")
        if self.trreb and self.trreb.kind == "market" and not self.trreb.field:
            raise ValueError(f"node {self.id}: a market trreb reference needs a field")
        return self


class Edge(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    source: str = Field(alias="from")
    target: str = Field(alias="to")
    sign: Literal["+", "-"]
    lag: str
    max_lag_months: int = 3
    confidence: Confidence
    review: Review
    rationale: str = Field(min_length=10)


class Graph(BaseModel):
    columns: list[str]
    nodes: list[Node]
    edges: list[Edge]


def load_graph(root: Path = GRAPH_DIR, catalogue: list[SeriesDef] | None = None) -> Graph:
    """Load and validate graph/nodes.yaml and graph/edges.yaml."""
    nodes_doc = yaml.safe_load((root / "nodes.yaml").read_text(encoding="utf-8"))
    edges_doc = yaml.safe_load((root / "edges.yaml").read_text(encoding="utf-8"))
    graph = Graph(
        columns=nodes_doc["columns"],
        nodes=[Node.model_validate(n) for n in nodes_doc["nodes"]],
        edges=[Edge.model_validate(e) for e in edges_doc["edges"]],
    )
    ids = [n.id for n in graph.nodes]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate node ids")
    known = set(ids)
    seen: set[tuple[str, str]] = set()
    for e in graph.edges:
        for end in (e.source, e.target):
            if end not in known:
                raise ValueError(f"edge {e.source}->{e.target}: unknown node {end!r}")
        if (e.source, e.target) in seen:
            raise ValueError(f"duplicate edge {e.source}->{e.target}")
        if e.source == e.target:
            raise ValueError(f"self edge on {e.source}")
        seen.add((e.source, e.target))
    for n in graph.nodes:
        if not 0 <= n.col < len(graph.columns):
            raise ValueError(f"node {n.id}: col {n.col} outside the declared columns")
    if catalogue is not None:
        series_ids = {s.id for s in catalogue}
        for n in graph.nodes:
            if n.series and n.series not in series_ids:
                raise ValueError(f"node {n.id}: series {n.series!r} is not in the catalogue")
    return graph


# --- Data check -------------------------------------------------------------------------------


def _month_key(d: date) -> int:
    return d.year * 12 + d.month - 1


def to_monthly(obs: list[tuple[date, float]]) -> dict[int, float]:
    """Last observation in each calendar month, keyed by a month counter."""
    out: dict[int, float] = {}
    for d, v in sorted(obs):
        out[_month_key(d)] = v
    return out


def is_rate_like(unit: str) -> bool:
    u = unit.lower()
    return u == "percent" or u.startswith("percent ") or u == "percentage points"


def monthly_changes(monthly: dict[int, float], rate_like: bool) -> dict[int, float]:
    """Change from the previous month: a difference for rates, a percent change for levels."""
    out: dict[int, float] = {}
    for k, v in monthly.items():
        prev = monthly.get(k - 1)
        if prev is None:
            continue
        if rate_like:
            out[k] = v - prev
        elif prev != 0:
            out[k] = (v / prev - 1) * 100
    return out


def pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True))
    return sxy / math.sqrt(sxx * syy)


def lagged_corr(x: dict[int, float], y: dict[int, float], lag: int) -> tuple[float | None, int]:
    """Correlation of x in month t with y in month t + lag (x leads y). Returns (r, pairs)."""
    pairs = [(v, y[k + lag]) for k, v in x.items() if (k + lag) in y]
    r = pearson([p[0] for p in pairs], [p[1] for p in pairs])
    return r, len(pairs)


def edge_evidence(
    x_obs: list[tuple[date, float]],
    x_unit: str,
    y_obs: list[tuple[date, float]],
    y_unit: str,
    sign: str,
    max_lag: int,
) -> dict:
    """Is the history consistent with the claimed sign, searching lags 0 to max_lag months?"""
    x = monthly_changes(to_monthly(x_obs), is_rate_like(x_unit))
    y = monthly_changes(to_monthly(y_obs), is_rate_like(y_unit))
    overlap = len(set(x) & set(y))
    if overlap < MIN_OVERLAP_MONTHS:
        return {"status": "insufficient", "overlap_months": overlap}
    best: tuple[float, int, int] | None = None
    for lag in range(0, max_lag + 1):
        r, n = lagged_corr(x, y, lag)
        if r is not None and (best is None or abs(r) > abs(best[0])):
            best = (r, lag, n)
    if best is None:
        return {"status": "insufficient", "overlap_months": overlap}
    r, lag, n = best
    r0, _ = lagged_corr(x, y, 0)
    if abs(r) < MIN_ABS_CORR:
        status = "weak"
    elif (r > 0) == (sign == "+"):
        status = "consistent"
    else:
        status = "opposite"
    return {
        "status": status,
        "best_lag_months": lag,
        "best_corr": round(r, 3),
        "corr_at_zero": None if r0 is None else round(r0, 3),
        "pairs": n,
        "overlap_months": overlap,
    }


def graph_payload(
    graph: Graph, conn: duckdb.DuckDBPyConnection, catalogue: list[SeriesDef]
) -> dict:
    """JSON for the front end: nodes, edges and a data check for each edge."""
    units = {s.id: s.unit for s in catalogue}
    node_by_id = {n.id: n for n in graph.nodes}

    def series_of(node_id: str) -> tuple[list[tuple[date, float]], str] | None:
        s = node_by_id[node_id].series
        if not s:
            return None
        rows = conn.execute(
            "SELECT obs_date, value FROM observation WHERE series_id = ? ORDER BY obs_date", [s]
        ).fetchall()
        return ([(d, float(v)) for d, v in rows], units[s]) if rows else None

    edges = []
    for e in graph.edges:
        xs, ys = series_of(e.source), series_of(e.target)
        if xs is None or ys is None:
            ev = {"status": "no_series"}
        else:
            ev = edge_evidence(xs[0], xs[1], ys[0], ys[1], e.sign, e.max_lag_months)
        edges.append({**e.model_dump(by_alias=True, mode="json"), "evidence": ev})
    return {
        "columns": graph.columns,
        "nodes": [n.model_dump(mode="json") for n in graph.nodes],
        "edges": edges,
    }
