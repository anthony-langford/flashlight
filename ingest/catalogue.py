from __future__ import annotations

from pathlib import Path

import yaml

from ingest.models import SeriesDef

DEFAULT_CATALOGUE_DIR = Path(__file__).resolve().parent.parent / "catalogue"


def load_catalogue(root: Path = DEFAULT_CATALOGUE_DIR) -> list[SeriesDef]:
    """Load every `*.yaml` under `root`, one series per file. Ids must be unique."""
    series: list[SeriesDef] = []
    seen: dict[str, Path] = {}
    for path in sorted(root.rglob("*.yaml")):
        with path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f)
        item = SeriesDef.model_validate(data)
        if item.id in seen:
            raise ValueError(f"duplicate series id {item.id!r} in {path} and {seen[item.id]}")
        seen[item.id] = path
        series.append(item)
    return series
