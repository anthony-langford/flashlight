from pathlib import Path

import pytest
import yaml

from ingest.catalogue import load_catalogue


def _entry(**overrides):
    base = {
        "id": "boc.policy_rate",
        "title": "Policy rate",
        "source": "boc_valet",
        "source_id": "V39079",
        "frequency": "daily",
        "unit": "percent",
        "geography": "Canada",
        "layer": "rates_credit",
    }
    base.update(overrides)
    return base


def _write(root: Path, name: str, data: dict) -> None:
    (root / name).write_text(yaml.safe_dump(data), encoding="utf-8")


def test_loads_valid_entries(tmp_path):
    _write(tmp_path, "a.yaml", _entry())
    series = load_catalogue(tmp_path)
    assert [s.id for s in series] == ["boc.policy_rate"]


def test_duplicate_ids_rejected(tmp_path):
    _write(tmp_path, "a.yaml", _entry())
    _write(tmp_path, "b.yaml", _entry())
    with pytest.raises(ValueError, match="duplicate series id"):
        load_catalogue(tmp_path)


def test_unknown_field_rejected(tmp_path):
    _write(tmp_path, "a.yaml", _entry(surprise="x"))
    with pytest.raises(ValueError):
        load_catalogue(tmp_path)


def test_bad_id_rejected(tmp_path):
    _write(tmp_path, "a.yaml", _entry(id="Policy Rate"))
    with pytest.raises(ValueError):
        load_catalogue(tmp_path)


def test_repo_catalogue_is_valid():
    series = load_catalogue()
    assert series, "catalogue should not be empty"
    ids = [s.id for s in series]
    assert len(ids) == len(set(ids))
    for s in series:
        assert s.explainer is not None, f"{s.id} is missing an explainer"
