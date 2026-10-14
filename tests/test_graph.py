import random
from datetime import date
from pathlib import Path

import pytest
import yaml

from ingest import graph as g
from ingest.catalogue import load_catalogue


def _write(root: Path, nodes: list[dict], edges: list[dict], columns=("A", "B")):
    (root / "nodes.yaml").write_text(yaml.safe_dump({"columns": list(columns), "nodes": nodes}))
    (root / "edges.yaml").write_text(yaml.safe_dump({"edges": edges}))


def _node(id, col=0, row=0, **kw):
    return {"id": id, "label": id, "col": col, "row": row, **kw}


def _edge(a, b, **kw):
    base = {
        "from": a, "to": b, "sign": "+", "lag": "immediate",
        "confidence": "plausible", "review": "draft", "rationale": "Because of a reason.",
    }  # fmt: skip
    return {**base, **kw}


def test_repo_graph_is_valid_against_the_catalogue():
    graph = g.load_graph(catalogue=load_catalogue())
    assert len(graph.nodes) >= 15 and len(graph.edges) >= 15
    # every edge starts as a draft until the owner reviews it
    assert all(e.review == g.Review.DRAFT for e in graph.edges)


def test_unknown_edge_endpoint_rejected(tmp_path):
    _write(tmp_path, [_node("a")], [_edge("a", "missing")])
    with pytest.raises(ValueError, match="unknown node"):
        g.load_graph(tmp_path)


def test_duplicate_and_self_edges_rejected(tmp_path):
    _write(tmp_path, [_node("a"), _node("b", col=1)], [_edge("a", "b"), _edge("a", "b")])
    with pytest.raises(ValueError, match="duplicate edge"):
        g.load_graph(tmp_path)
    _write(tmp_path, [_node("a")], [_edge("a", "a")])
    with pytest.raises(ValueError, match="self edge"):
        g.load_graph(tmp_path)


def test_node_column_must_be_declared(tmp_path):
    _write(tmp_path, [_node("a", col=5)], [])
    with pytest.raises(ValueError, match="outside the declared columns"):
        g.load_graph(tmp_path)


def test_node_series_must_exist_in_catalogue(tmp_path):
    _write(tmp_path, [_node("a", series="nope.nothing")], [])
    with pytest.raises(ValueError, match="not in the catalogue"):
        g.load_graph(tmp_path, catalogue=load_catalogue())


def test_node_cannot_have_two_sources(tmp_path):
    n = _node("a", series="boc.policy_rate", trreb={"kind": "hpi", "area": "x", "home_type": "y"})
    _write(tmp_path, [n], [])
    with pytest.raises(ValueError):
        g.load_graph(tmp_path)


def test_bad_sign_and_short_rationale_rejected(tmp_path):
    _write(tmp_path, [_node("a"), _node("b", col=1)], [_edge("a", "b", sign="?")])
    with pytest.raises(ValueError):
        g.load_graph(tmp_path)
    _write(tmp_path, [_node("a"), _node("b", col=1)], [_edge("a", "b", rationale="short")])
    with pytest.raises(ValueError):
        g.load_graph(tmp_path)


def _series(seed, months=120, start=(2010, 1)):
    rnd = random.Random(seed)
    v, out = 100.0, []
    y, m = start
    for _ in range(months):
        v += rnd.gauss(0, 1)
        out.append((date(y, m, 15), v))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def test_recovers_a_known_lag_and_sign():
    rnd = random.Random(7)
    x = _series(1)
    # dx[j] is x's change into month j+1, so y's change in month i = dx[i-3] is x's change in
    # month i-2: x leads y by exactly two months, plus a little noise.
    dx = [b[1] - a[1] for a, b in zip(x, x[1:], strict=False)]
    y_vals, v = [], 50.0
    for i in range(len(x)):
        step = dx[i - 3] if i >= 3 else 0.0
        v += step + rnd.gauss(0, 0.2)
        y_vals.append(v)
    y = [(d, val) for (d, _), val in zip(x, y_vals, strict=True)]
    ev = g.edge_evidence(x, "percent", y, "percent", "+", max_lag=6)
    assert ev["status"] == "consistent"
    assert ev["best_lag_months"] == 2
    assert ev["best_corr"] > 0.8


def test_opposite_sign_is_reported():
    x = _series(2)
    y = [(d, -v) for d, v in x]
    ev = g.edge_evidence(x, "percent", y, "percent", "+", max_lag=2)
    assert ev["status"] == "opposite"
    assert ev["best_corr"] < -0.9


def test_unrelated_series_are_weak():
    ev = g.edge_evidence(_series(3), "percent", _series(4), "percent", "+", max_lag=3)
    assert ev["status"] == "weak"


def test_short_overlap_is_insufficient_not_a_number():
    ev = g.edge_evidence(_series(5, months=24), "percent", _series(6, months=24), "percent", "+", 3)
    assert ev == {"status": "insufficient", "overlap_months": 23}


def test_annual_series_cannot_be_checked():
    annual = [(date(2000 + i, 1, 1), 100.0 + i) for i in range(25)]
    ev = g.edge_evidence(annual, "persons", _series(8), "percent", "+", 3)
    assert ev["status"] == "insufficient"


def test_changes_use_difference_for_rates_and_percent_for_levels():
    monthly = {1: 2.0, 2: 2.5, 3: 5.0}
    assert g.monthly_changes(monthly, rate_like=True) == {2: 0.5, 3: 2.5}
    pct = g.monthly_changes(monthly, rate_like=False)
    assert pct[2] == pytest.approx(25.0) and pct[3] == pytest.approx(100.0)


def test_gaps_do_not_create_changes():
    assert g.monthly_changes({1: 1.0, 3: 2.0}, rate_like=True) == {}


def test_monthly_keeps_last_observation_in_month():
    obs = [(date(2026, 1, 3), 1.0), (date(2026, 1, 28), 2.0), (date(2026, 2, 1), 3.0)]
    m = g.to_monthly(obs)
    assert sorted(m.values()) == [2.0, 3.0]


def test_medium_history_is_labelled_preliminary_and_searches_few_lags():
    rnd = random.Random(11)
    x = _series(21, months=40)
    dx = [b[1] - a[1] for a, b in zip(x, x[1:], strict=False)]
    v, y_vals = 50.0, []
    for i in range(len(x)):
        # dx[j] is x's change into month j+1, so dx[i-2] is x's change in month i-1: a lead of one
        v += (dx[i - 2] if i >= 2 else 0.0) + rnd.gauss(0, 0.2)
        y_vals.append(v)
    y = [(d, val) for (d, _), val in zip(x, y_vals, strict=True)]
    ev = g.edge_evidence(x, "percent", y, "percent", "+", max_lag=12)
    assert ev["preliminary"] is True
    assert ev["searched_lags"] == g.PRELIMINARY_MAX_LAG
    assert ev["status"] == "consistent" and ev["best_lag_months"] == 1


def test_long_history_is_not_preliminary():
    ev = g.edge_evidence(_series(31), "percent", _series(32), "percent", "+", max_lag=6)
    assert ev["preliminary"] is False and ev["searched_lags"] == 6


def test_unknown_trreb_field_is_rejected(tmp_path):
    n = _node(
        "a", trreb={"kind": "market", "area": "x", "home_type": "y", "field": "x; DROP TABLE"}
    )
    _write(tmp_path, [n], [])
    with pytest.raises(ValueError, match="unknown trreb field"):
        g.load_graph(tmp_path)


def test_payload_uses_trreb_series_for_trreb_nodes(tmp_path):
    from ingest import db
    from ingest.sources.trreb import DistrictRow

    conn = db.connect(":memory:")
    rows = []
    y, m = 2024, 1
    rnd = random.Random(5)
    for _ in range(40):
        s = 1000 + rnd.gauss(0, 50)
        rows.append(
            DistrictRow(
                date(y, m, 1),
                "City of Toronto",
                "all",
                {"sales": s, "months_inventory": 3 - s / 1000},
            )
        )
        m += 1
        if m == 13:
            y, m = y + 1, 1
    db.upsert_trreb(conn, rows)
    nodes = [
        _node(
            "sales",
            trreb={
                "kind": "market",
                "area": "City of Toronto",
                "home_type": "all",
                "field": "sales",
            },
        ),
        _node(
            "inv",
            col=1,
            trreb={
                "kind": "market",
                "area": "City of Toronto",
                "home_type": "all",
                "field": "months_inventory",
            },
        ),
    ]
    _write(tmp_path, nodes, [_edge("sales", "inv", sign="-", max_lag_months=2)])
    payload = g.graph_payload(g.load_graph(tmp_path), conn, [])
    ev = payload["edges"][0]["evidence"]
    assert ev["preliminary"] is True and ev["status"] == "consistent"
    assert ev["best_corr"] < -0.5
