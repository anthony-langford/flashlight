from __future__ import annotations

import os
import re
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"

_SECRET_PARAM = re.compile(r"(api_key=)[^&\s'\"]+", re.IGNORECASE)


def load_env(path: Path = ENV_PATH) -> None:
    """Load KEY=VALUE lines from `.env` into os.environ without overriding existing values."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def redact(text: str) -> str:
    """Strip API keys from text that may contain a request URL, before logging or storing it."""
    return _SECRET_PARAM.sub(r"\1REDACTED", text)
