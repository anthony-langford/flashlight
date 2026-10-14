# Flashlight

A personal learning tool for understanding the Toronto housing market and the macro environment around it.

Flashlight pulls public economic and housing data, explains each indicator in plain language, and shows how the indicators influence each other through an interactive causal map. The first use case is a home purchase in Toronto. A broader Canada / US / China macro dashboard is planned later as a second topic pack on the same foundation.

**This README is the living source of truth for project status.** It is updated in every commit that changes status. Detail lives in [docs/](docs/). If this file and a doc disagree about status, this file wins and the doc should be fixed.

## Status

Last updated: 2026-10-14. Phase: M1 (data foundation) and M2 (export and first UI) done. M3 (causal map) is next.

- [x] Idea explored, market scanned, scope agreed ([docs/PROJECT.md](docs/PROJECT.md))
- [x] Data source feasibility checked ([docs/DATA_SOURCES.md](docs/DATA_SOURCES.md))
- [x] Repo, license, gitignore, design docs
- [x] Toolchain: `uv` 0.13 and managed Python 3.12 installed (via Homebrew), Node 26 available
- [x] Python project scaffolded (`pyproject.toml`, `ingest/` package, pytest, ruff)
- [ ] Series catalogue (YAML) for the v1 series: 42 series done (BoC 11 incl. USD/CAD, FRED 8, StatCan Toronto 19, CMHC 4), all with drafted explainers awaiting owner review. TRREB lives in its own tables (`trreb_monthly`, `trreb_hpi`), not the catalogue
- [x] Bank of Canada Valet client (tests, fixture). `uv run python -m ingest sync --source boc_valet` loads all 10 BoC series (verified 2026-10-14, history from 1975 to 2001 depending on series)
- [x] DuckDB schema, idempotent upserts, 45-day revision lookback, per-series error isolation
- [x] FRED client (key via `.env`, redacted from logs, errors and the DB; tests). 8 FRED series plus BoC USD/CAD synced live 2026-10-14
- [x] StatCan client (vector-based, verified live; matches results by vector id because the API reorders batches). Retry with backoff for transient errors
- [x] TRREB Market Watch parser: monthly district tables by home type (sales, prices, listings, SP/LP, days on market). Verified on Sept 2026 PDF (760 rows). `uv run python -m ingest trreb --from 2026-09`. MLS HPI benchmark prices by district also parsed (343 rows, positions-based). Older PDF layouts unsupported
- [x] CMHC Rental Market Survey (Toronto CMA vacancy, turnover, two-bedroom rent and change; editions 2021 to 2025 downloaded and parsed). 4 series. Purpose-built apartments only
- [x] Export step: `uv run python -m ingest export` writes catalogue summaries (latest value, 1-year change, year-over-year for index series, percentile, staleness), per-series JSON and TRREB tables to `app/public/data/` (gitignored). Buyer profile in `config/buyer.yaml`
- [x] React app (Vite, TypeScript, ECharts) with two views: Overview (market snapshot tiles, target-district HPI benchmark chart against your budget band, district sales table) and Indicators (all 42 series with range filter, year-over-year toggle for index series, table view, percentile meter, draft explainers, source and licence). Light and dark themes, colors validated. Linkable via `#/indicators/<series id>`. 12 unit tests
- [ ] Causal map (M3), owner review of drafted explainers and edges
- [ ] Mortgage calculator (M4), blocked on verifying the rules listed below

## Buyer profile (drives priorities)

Stated by the owner on 2026-10-14.

- **Timeline:** 3 months to 1 year. Near-term indicators (rates, listings, inventory, affordability) come first.
- **Property:** freehold, semi-detached or detached.
- **Budget:** $1.10M to $1.35M. Used for affordability defaults.
- **Target areas:** east end and west end, with good school districts in mind. Named examples: Riverdale and Monarch Park (east end), Sunnylea (west end, Etobicoke).
- TRREB districts: Riverdale is E01. Monarch Park and Sunnylea are not TRREB communities and their districts are unconfirmed (see Open questions).

## Next steps

1. TRREB: find a way to recover history before Sept 2026 (older PDF layout). Until then history builds month by month.
2. Causal map: nodes and edges from `graph/`, React Flow view, node state colouring (M3). Needs owner review of the draft edges in docs/CAUSAL_MAP.md.
3. Verify the mortgage and tax rules listed below against official sources, then build the payment calculator (M4).

## Milestones

- **M1 Data foundation:** ingestion, catalogue, DuckDB, tests (current)
- **M2 Export and first UI:** done. See Status
- **M3 Causal map:** React Flow view, owner review of draft edges, lead/lag evidence ([docs/CAUSAL_MAP.md](docs/CAUSAL_MAP.md))
- **M4 Housing tools:** mortgage calculator on live rates, Toronto overview, release calendar, land transfer tax and closing costs
- **M5 Discovery and polish:** LLM-assisted series suggestions checked against real series, weekly digest, hosting and licence review

## Backlog

- School quality context for target areas (TDSB catchments, EQAO or similar). A new data domain, not part of M1. Needs a source review first.
- Neighbourhood-level TRREB data for the target districts (see open questions).
- Visualisation ideas in [docs/PROJECT.md](docs/PROJECT.md).

## Open questions

- Neighbourhood to TRREB district mapping. Riverdale is E01 (2019 community report). Monarch Park (candidates E01, E02, E03) and Sunnylea (candidates W07, W08) are unconfirmed. See docs/DATA_SOURCES.md. Needs school catchment boundaries and current TRREB maps.
- How to recover TRREB history before Sept 2026 (older PDF layout has duplicated text layers).
- Which school-quality source, if any, is acceptable to use.

## Must verify before building the mortgage calculator

None of these are stated from memory in the docs. Verify each against an official source and record the date.

- Mortgage stress test (minimum qualifying rate) rule
- Insured mortgage price cap and minimum down payment tiers. A $1.10M to $1.35M budget sits near these thresholds and the rules have changed recently.
- Toronto land transfer tax (provincial and municipal) and any first-time-buyer rebates
- Maximum amortization rules for insured and uninsured mortgages

## Open data items

Tracked in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) under "Known gaps and open items". Highest priority: Toronto population components, and CMHC data licence (personal use only until found or consent is given). Licence terms for all sources were read 2026-10-14, see the hosting table in docs/DATA_SOURCES.md.

## What it is

- **A learning app first, a dashboard second.** Every series has a short explainer: what it measures, why it matters for a Toronto buyer, how to read high vs low, and what it tends to move with.
- **A causal map.** Indicators are nodes, relationships are directed edges with a sign, a typical lag, a rationale and a confidence tag. Click a node to see the live series. Trace a shock through the downstream chain.
- **Local first.** Everything runs on your machine. Hosting and sharing come later.

## Architecture in one paragraph

Python ingestion scripts pull from the Bank of Canada Valet API, Statistics Canada, FRED, and manually maintained files (TRREB, CMHC). Data lands in a local DuckDB file. An export step writes static JSON that a React + TypeScript (Vite) app reads, so the front end has no server dependency and can be hosted as a static site later. Series metadata and explainers live in YAML under `catalogue/`, and causal map edges live in `graph/`. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

| Doc | Purpose |
|---|---|
| [docs/PROJECT.md](docs/PROJECT.md) | Goals, scope, decisions log, visualisation ideas |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, repo layout, data flow, conventions |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Verified series IDs, access methods, licensing notes, gaps |
| [docs/CAUSAL_MAP.md](docs/CAUSAL_MAP.md) | Causal map design, edge schema, draft nodes and edges |

If you are picking this project up fresh (new chat, fork or agent), read [AGENTS.md](AGENTS.md), then this README.

## Development

Requires `uv`, Node and poppler (`brew install poppler`, for TRREB PDFs). Copy `.env.example` to `.env` and set `FRED_API_KEY`.

```
uv sync              # install Python deps (uses Python 3.12)
uv run pytest        # tests
uv run ruff check .  # lint
uv run python -m ingest sync [--source boc_valet] [--series ID] [--full]
                     # fetch series into data/flashlight.duckdb
uv run python -m ingest trreb --from 2026-09   # download and parse TRREB PDFs
uv run python -m ingest export                 # write JSON for the app

cd app && npm install
npm run dev          # http://localhost:5173 (run the export first)
npm test             # unit tests
npm run build        # typecheck and build
```

More commands are added here as the code lands.

## Maintaining this file

- Update Status, Next steps, Open questions and the Session log in the same commit as the work.
- Mark something verified only if it was actually fetched or tested, and record the date.
- Keep it short. Move detail into docs/ and link to it.

## Data and licensing

The code is MIT licensed (see [LICENSE](LICENSE)). The data is not. Each source has its own terms, summarised in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md). Downloaded data and the local database are gitignored and are not redistributed by this repo. TRREB reports are copyrighted, and some FRED series carry third-party copyright.

This product uses the FRED(R) API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.

## Disclaimer

Educational project. Nothing here is financial, mortgage or real estate advice.

## Session log

| Date | Summary |
|---|---|
| 2026-10-14 | Explored idea and market. Chose scope (Toronto housing, no China). Verified BoC, StatCan and FRED series and Toronto coverage. CMHC and TRREB are file-based only. Created repo and docs, pushed. Recorded buyer profile. Installed uv and Python 3.12. Made README the status source of truth. Built BoC, FRED and StatCan clients (38 series) and a TRREB PDF parser (Sept 2026 layout). Installed poppler. Added CMHC rent, JSON export and the React app (Overview and Indicators). |
| 2026-10-14 | Review pass 1 (self-review of M1 and M2). Fixed: staleness now computed at view time, district table can no longer mix months, chart holds the previous render while loading, export has `--no-trreb` and the UI handles it. Read the StatCan, BoC and CMHC terms: CMHC is personal use only, BoC FX is LSEG-sourced. Added the review loop to AGENTS.md. |
