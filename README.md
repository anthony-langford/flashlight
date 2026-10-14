# Flashlight

A personal learning tool for understanding the Toronto housing market and the macro environment around it.

Flashlight pulls public economic and housing data, explains each indicator in plain language, and shows how the indicators influence each other through an interactive causal map. The first use case is a home purchase in Toronto. A broader Canada / US / China macro dashboard is planned later as a second topic pack on the same foundation.

**This README is the living source of truth for project status.** It is updated in every commit that changes status. Detail lives in [docs/](docs/). If this file and a doc disagree about status, this file wins and the doc should be fixed.

## Status

Last updated: 2026-10-14. Phase: M1 (data foundation) in progress. No application code is finished yet.

- [x] Idea explored, market scanned, scope agreed ([docs/PROJECT.md](docs/PROJECT.md))
- [x] Data source feasibility checked ([docs/DATA_SOURCES.md](docs/DATA_SOURCES.md))
- [x] Repo, license, gitignore, design docs
- [x] Toolchain: `uv` 0.13 and managed Python 3.12 installed (via Homebrew), Node 26 available
- [ ] Python project scaffolded (`pyproject.toml`, `ingest/` package, tests)
- [ ] Series catalogue (YAML) for the v1 series
- [ ] Bank of Canada Valet client
- [ ] DuckDB schema and loader
- [ ] FRED client
- [ ] StatCan client (vector-based)
- [ ] Manual-entry templates (TRREB, CMHC rent)
- [ ] Export step to JSON
- [ ] React app scaffolded
- [ ] First views, then causal map

## Buyer profile (drives priorities)

Stated by the owner on 2026-10-14.

- **Timeline:** 3 months to 1 year. Near-term indicators (rates, listings, inventory, affordability) come first.
- **Property:** freehold, semi-detached or detached.
- **Budget:** $1.10M to $1.35M. Used for affordability defaults.
- **Target areas:** east end and west end, with good school districts in mind. Named examples: Riverdale and Monarch Park (east end), Sunnylea (west end, Etobicoke).
- TRREB district codes for these areas have not been confirmed yet. They must be read from an actual Market Watch PDF, not assumed.

## Next steps

1. Scaffold the Python project and catalogue.
2. Bank of Canada Valet client with tests, then DuckDB loader.
3. FRED client, then StatCan client (take Toronto vector IDs from the full-table CSVs, then test the WDS vector endpoints).
4. Manual-entry templates: TRREB monthly by district and property type, CMHC rent.
5. Export to JSON, then scaffold the React app.

## Milestones

- **M1 Data foundation:** ingestion, catalogue, DuckDB, tests (current)
- **M2 Export and first UI:** series pages with ECharts, last-updated labels, explainers, percentile gauges
- **M3 Causal map:** React Flow view, owner review of draft edges, lead/lag evidence ([docs/CAUSAL_MAP.md](docs/CAUSAL_MAP.md))
- **M4 Housing tools:** mortgage calculator on live rates, Toronto overview, release calendar, land transfer tax and closing costs
- **M5 Discovery and polish:** LLM-assisted series suggestions checked against real series, weekly digest, hosting and licence review

## Backlog

- School quality context for target areas (TDSB catchments, EQAO or similar). A new data domain, not part of M1. Needs a source review first.
- Neighbourhood-level TRREB data for the target districts (see open questions).
- Visualisation ideas in [docs/PROJECT.md](docs/PROJECT.md).

## Open questions

- Exact TRREB districts for Riverdale, Monarch Park and Sunnylea, and which other east and west end districts to compare. Read from a Market Watch PDF.
- TRREB capture: manual monthly entry or a PDF parser? Decide after seeing a PDF.
- Which school-quality source, if any, is acceptable to use.

## Must verify before building the mortgage calculator

None of these are stated from memory in the docs. Verify each against an official source and record the date.

- Mortgage stress test (minimum qualifying rate) rule
- Insured mortgage price cap and minimum down payment tiers. A $1.10M to $1.35M budget sits near these thresholds and the rules have changed recently.
- Toronto land transfer tax (provincial and municipal) and any first-time-buyer rebates
- Maximum amortization rules for insured and uninsured mortgages

## Open data items

Tracked in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) under "Known gaps and open items". Highest priority: Toronto population components, WDS vector endpoint test, CMHC workbook inspection, StatCan and BoC licence terms.

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

Requires `uv` and Node. Copy `.env.example` to `.env` and set `FRED_API_KEY`. Commands will be added here as the code lands.

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
| 2026-10-14 | Explored idea and market. Chose scope (Toronto housing, no China). Verified BoC, StatCan and FRED series and Toronto coverage. CMHC and TRREB are file-based only. Created repo and docs, pushed. Recorded buyer profile. Installed uv and Python 3.12. Made README the status source of truth. |
