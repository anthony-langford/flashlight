import json
from datetime import date

from ingest import db, export
from ingest.graph import Graph
from ingest.models import Observation, SeriesDef

NO_GRAPH = Graph(columns=[], nodes=[], edges=[])


def _series(sid: str, unit: str = "percent", freq: str = "monthly") -> SeriesDef:
    return SeriesDef.model_validate(
        {
            "id": sid, "title": sid, "source": "boc_valet", "source_id": "X",
            "frequency": freq, "unit": unit, "geography": "Canada", "layer": "rates_credit",
            "explainer": {
                "what": "w", "why_it_matters": "y", "how_to_read": "r", "moves_with": [],
            },
        }
    )  # fmt: skip


def _load(conn, sid, pairs):
    db.upsert_observations(conn, sid, [Observation(obs_date=d, value=v) for d, v in pairs])


def test_yoy_uses_value_one_year_earlier():
    obs = [(date(2025, 1, 1), 100.0), (date(2025, 2, 1), 101.0), (date(2026, 1, 1), 110.0)]
    out = export.yoy_series(obs)
    assert out == [(date(2026, 1, 1), 10.0)]


def test_yoy_skips_when_no_close_prior_observation():
    obs = [(date(2024, 6, 1), 100.0), (date(2026, 1, 1), 110.0)]
    assert export.yoy_series(obs) == []


def test_index_percentile_uses_year_over_year_not_level():
    # A rising index level is always at its own high, so ranking the level would say 100.
    obs = [
        (date(2024, 6, 1), 100.0),
        (date(2025, 6, 1), 110.0),  # +10 percent
        (date(2026, 6, 1), 111.1),  # +1 percent
    ]
    s = _series("a.cpi", unit="index (2002=100)")
    summary = export._summary(s, obs, date(2026, 7, 1), export.yoy_series(obs))
    # year-over-year rates are [10.0, 1.0] and the latest is 1.0, so half are at or below it
    assert summary["percentile"] == 50.0


def test_percentile_rank():
    assert export.percentile_rank([1, 2, 3, 4], 4) == 100.0
    assert export.percentile_rank([1, 2, 3, 4], 1) == 25.0


def test_export_writes_files_and_summaries(tmp_path, monkeypatch):
    monkeypatch.setattr(export, "BUYER_CONFIG", export.ROOT / "config" / "buyer.yaml")
    conn = db.connect(":memory:")
    level = _series("a.rate")
    index = _series("a.cpi", unit="index (2002=100)")
    _load(conn, "a.rate", [(date(2025, 6, 1), 3.0), (date(2026, 6, 1), 2.0)])
    _load(conn, "a.cpi", [(date(2025, 6, 1), 100.0), (date(2026, 6, 1), 103.0)])
    meta = export.export(conn, [level, index], tmp_path, today=date(2026, 7, 1), graph=NO_GRAPH)
    assert meta["series"] == 2

    cat = {c["id"]: c for c in json.loads((tmp_path / "catalogue.json").read_text())}
    assert cat["a.rate"]["latest"] == {"date": "2026-06-01", "value": 2.0}
    assert cat["a.rate"]["change_1y_abs"] == -1.0
    assert cat["a.rate"]["yoy_pct"] is None
    assert cat["a.rate"]["stale_days"] == 30
    assert cat["a.cpi"]["yoy_pct"] == 3.0
    assert cat["a.cpi"]["change_1y_abs"] is None

    series = json.loads((tmp_path / "series" / "a.cpi.json").read_text())
    assert series["obs"][-1] == ["2026-06-01", 103.0]
    assert series["yoy"] == [["2026-06-01", 3.0]]
    assert json.loads((tmp_path / "series" / "a.rate.json").read_text())["yoy"] is None
    assert (tmp_path / "buyer.json").exists()
    assert (tmp_path / "trreb.json").exists()


def test_series_without_data_is_skipped(tmp_path):
    conn = db.connect(":memory:")
    meta = export.export(
        conn, [_series("a.empty")], tmp_path, today=date(2026, 7, 1), graph=NO_GRAPH
    )
    assert meta["series"] == 0


def test_no_trreb_writes_an_empty_payload(tmp_path):
    conn = db.connect(":memory:")
    from ingest.sources.trreb import DistrictRow

    db.upsert_trreb(
        conn,
        [DistrictRow(date(2026, 9, 1), "Toronto E01", "detached", {"sales": 13.0})],
    )
    export.export(conn, [], tmp_path, today=date(2026, 10, 1), include_trreb=False, graph=NO_GRAPH)
    payload = json.loads((tmp_path / "trreb.json").read_text())
    assert payload["market"] == [] and payload["hpi"] == []
    # and the default still exports it
    export.export(conn, [], tmp_path, today=date(2026, 10, 1), graph=NO_GRAPH)
    assert len(json.loads((tmp_path / "trreb.json").read_text())["market"]) == 1
