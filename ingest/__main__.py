from __future__ import annotations

import argparse
import logging
import sys

import httpx

from ingest import db
from ingest.catalogue import load_catalogue
from ingest.sync import sync


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ingest")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("sync", help="fetch series into the local DuckDB file")
    p.add_argument("--source", help="only series from this source (for example boc_valet)")
    p.add_argument("--series", action="append", help="only this series id (repeatable)")
    p.add_argument("--full", action="store_true", help="re-fetch full history")
    p.add_argument("--db", default=str(db.DEFAULT_DB_PATH))
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    series = load_catalogue()
    if args.source:
        series = [s for s in series if s.source.value == args.source]
    if args.series:
        series = [s for s in series if s.id in set(args.series)]
    if not series:
        print("no matching series", file=sys.stderr)
        return 2

    conn = db.connect(args.db)
    headers = {"User-Agent": "flashlight/0.1 (personal project)"}
    with httpx.Client(timeout=30.0, headers=headers) as client:
        results = sync(conn, series, client, full=args.full)
    for sid, status in results.items():
        print(f"{status:8} {sid}")
    return 1 if "error" in results.values() else 0


if __name__ == "__main__":
    raise SystemExit(main())
