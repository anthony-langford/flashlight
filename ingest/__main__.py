from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date
from pathlib import Path

import httpx

from ingest import db
from ingest import export as export_mod
from ingest import review as review_mod
from ingest.catalogue import load_catalogue
from ingest.config import load_env
from ingest.graph import load_graph
from ingest.sources import trreb
from ingest.sync import sync


def _month(text: str) -> date:
    year, month = text.split("-")
    return date(int(year), int(month), 1)


def run_trreb(args: argparse.Namespace) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    start = _month(args.start)
    end = _month(args.end) if args.end else date.today().replace(day=1)
    conn = db.connect(args.db)
    failures = 0
    headers = {"User-Agent": "flashlight/0.1 (personal project)"}
    with httpx.Client(timeout=60.0, headers=headers) as client:
        year, month = start.year, start.month
        while (year, month) <= (end.year, end.month):
            try:
                path = trreb.download(client, year, month)
                if path is None:
                    print(f"{year}-{month:02d}  not published")
                else:
                    rows = trreb.parse_text(trreb.pdf_to_text(path))
                    if not rows:  # earlier layout: rows are drawn twice, recover from positions
                        rows = trreb.parse_old_layout(trreb.pdf_to_bbox(path))
                    db.upsert_trreb(conn, rows)
                    hpi = trreb.parse_hpi(trreb.pdf_to_bbox(path))
                    db.upsert_hpi(conn, hpi)
                    if rows or hpi:
                        note = "" if rows else " (sales tables not parsed)"
                        print(f"{year}-{month:02d}  {len(rows)} rows, {len(hpi)} HPI rows{note}")
                    else:
                        print(f"{year}-{month:02d}  nothing parsed", file=sys.stderr)
                        failures += 1
            except Exception as exc:  # keep going so one bad month does not stop the rest
                print(f"{year}-{month:02d}  error: {exc}", file=sys.stderr)
                failures += 1
            year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return 1 if failures else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ingest")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("sync", help="fetch series into the local DuckDB file")
    p.add_argument("--source", help="only series from this source (for example boc_valet)")
    p.add_argument("--series", action="append", help="only this series id (repeatable)")
    p.add_argument("--full", action="store_true", help="re-fetch full history")
    p.add_argument("--db", default=str(db.DEFAULT_DB_PATH))
    t = sub.add_parser("trreb", help="download and parse TRREB Market Watch PDFs (personal use)")
    t.add_argument("--from", dest="start", required=True, help="first month, YYYY-MM")
    t.add_argument("--to", dest="end", help="last month, YYYY-MM (default: current month)")
    t.add_argument("--db", default=str(db.DEFAULT_DB_PATH))
    r = sub.add_parser("review", help="write docs/REVIEW_SHEET.md for the owner to review")
    r.add_argument(
        "--out", default=str(Path(__file__).resolve().parent.parent / "docs" / "REVIEW_SHEET.md")
    )
    e = sub.add_parser("export", help="write static JSON for the front end")
    e.add_argument("--db", default=str(db.DEFAULT_DB_PATH))
    e.add_argument("--out", default=str(export_mod.DEFAULT_OUT))
    e.add_argument(
        "--no-trreb",
        action="store_true",
        help="leave TRREB data out (copyrighted), for output that may be hosted",
    )
    args = parser.parse_args(argv)

    if args.cmd == "trreb":
        return run_trreb(args)
    if args.cmd == "review":
        catalogue = load_catalogue()
        text = review_mod.render(load_graph(catalogue=catalogue), catalogue)
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"wrote {args.out}")
        return 0
    if args.cmd == "export":
        meta = export_mod.export(
            db.connect(args.db),
            load_catalogue(),
            Path(args.out),
            include_trreb=not args.no_trreb,
        )
        print(json.dumps(meta))
        return 0
    load_env()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    # httpx logs full request URLs at INFO, which would include API keys.
    logging.getLogger("httpx").setLevel(logging.WARNING)
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
    transport = httpx.HTTPTransport(retries=3)  # retries connect and handshake failures
    with httpx.Client(timeout=30.0, headers=headers, transport=transport) as client:
        results = sync(conn, series, client, full=args.full)
    for sid, status in results.items():
        print(f"{status:8} {sid}")
    return 1 if "error" in results.values() else 0


if __name__ == "__main__":
    raise SystemExit(main())
