# Flashlight

A personal learning tool for understanding the Toronto housing market and the macro environment around it.

Flashlight pulls public economic and housing data, explains each indicator in plain language, and shows how the indicators influence each other through an interactive causal map. The first use case is a first-time home purchase in Toronto. A broader Canada / US / China macro dashboard is planned as a second topic pack on the same foundation.

Status: early design. See [docs/ROADMAP.md](docs/ROADMAP.md) for current progress and next steps.

## What it is

- **A learning app first, a dashboard second.** Every series has a short explainer: what it measures, why it matters for a Toronto buyer, how to read high vs low, and what it tends to move with.
- **A causal map.** Indicators are nodes, relationships are directed edges with a sign, a typical lag, a rationale and a confidence tag. Click a node to see the live series. Trace a shock (for example, "the Bank of Canada cuts 50 bps") through the downstream chain.
- **Local first.** Everything runs on your machine. Hosting and sharing come later.

## Planned views

- Toronto market overview (prices, sales, listings, inventory)
- Affordability: mortgage payment calculator on live rates, price-to-income
- Causal map
- Percentile gauges (where is today vs the indicator's own history)
- Release calendar (what publishes this week)

More ideas are in [docs/PROJECT.md](docs/PROJECT.md).

## Architecture in one paragraph

Python ingestion scripts pull from the Bank of Canada Valet API, Statistics Canada, FRED, and a few manually maintained files (TRREB, CMHC). Data lands in a local DuckDB file. An export step writes static JSON that a React + TypeScript (Vite) app reads, so the front end has no server dependency and can be hosted as a static site later. Series metadata and explainers live in YAML under `catalogue/`, and causal map edges live in `graph/`. Details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentation

| Doc | Purpose |
|---|---|
| [docs/PROJECT.md](docs/PROJECT.md) | Goals, scope, user context, ideas and decisions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, repo layout, data flow, conventions |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Verified series IDs, access methods, licensing notes, open gaps |
| [docs/CAUSAL_MAP.md](docs/CAUSAL_MAP.md) | Causal map design, edge schema, seed nodes and edges |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Status, milestones, open items, how to resume work |

If you are picking this project up fresh (new chat, fork or agent), start with [AGENTS.md](AGENTS.md) and then [docs/ROADMAP.md](docs/ROADMAP.md).

## Data and licensing

The code is MIT licensed (see [LICENSE](LICENSE)). The data is not. Each source has its own terms, summarised in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md). Downloaded data and the local database are gitignored and are not redistributed by this repo. In particular, TRREB reports are copyrighted, and some FRED series carry third-party copyright.

This product uses the FRED(R) API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.

## Disclaimer

This is an educational project. Nothing here is financial, mortgage or real estate advice.
