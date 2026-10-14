# Architecture

Status: planned. Nothing below is implemented yet unless the README status says so.

## Data flow

```
 BoC Valet   StatCan WDS/CSV   FRED API    manual files (TRREB, CMHC)
     \             |             /                 |
      +------ ingest/ (Python) ------------------+
                      |
              data/flashlight.duckdb   (local, gitignored)
                      |
              export step (Python)
                      |
          app/public/data/*.json        (generated, gitignored)
                      |
        app/ (React + TypeScript + Vite, static)
```

The front end reads static JSON only. It needs no backend, so the built app can be hosted on any static host later. A hosted version would run the ingest and export steps on a schedule.

## Repo layout (target)

```
flashlight/
  README.md  AGENTS.md  CLAUDE.md  LICENSE  .gitignore
  docs/                 design docs (this folder)
  catalogue/            one YAML file per series: id, source, frequency, units, explainer, licence notes
  graph/                causal map nodes and edges (YAML)
  ingest/               Python package: source clients, normalisation, loaders
  data/                 local database and downloads (gitignored)
    manual/             manual-entry CSVs, only *.template.csv tracked
  export/               DB -> JSON for the front end (may live inside ingest/)
  app/                  React + TypeScript + Vite
  tests/                Python tests
```

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Ingestion | Python 3.12+, `uv`, `httpx`, `pydantic`, `pyyaml` | Small typed modules, one client per source |
| Storage | DuckDB (single local file) | Good for time series and percentile queries |
| Front end | React + TypeScript + Vite | Static build |
| Charts | Apache ECharts | Annotations, mark lines, heatmaps, maps |
| Causal map | React Flow | Custom nodes show live state and sparkline |
| State | Keep simple (React state / context). Add a store only if needed. | |
| Tests | pytest (Python), Vitest (front end) | |

These are proposals made on 2026-10-14. Library choices are not locked. Revisit if one proves awkward.

## Normalised schema (DuckDB)

```
series(series_id PK, source, source_id, title, unit, frequency, geography, seasonal_adj,
       catalogue_path, first_obs, last_obs, last_fetched_at)
observation(series_id, obs_date, value, PRIMARY KEY (series_id, obs_date))
fetch_log(series_id, fetched_at, rows, status, note)
```

`series_id` is a stable internal slug, for example `boc.policy_rate` or `statcan.toronto.housing_starts.total`. Source IDs never appear in the front end except in a "source" footnote.

## Catalogue entry shape

```yaml
id: boc.policy_rate
title: Bank of Canada policy rate (target overnight rate)
source: boc_valet
source_id: V39079
frequency: daily
unit: percent
geography: Canada
layer: rates_credit          # one of the layers in PROJECT.md scope
explainer:
  what: The rate the Bank of Canada wants for overnight lending between banks.
  why_it_matters: Sets the floor for prime and variable mortgage rates.
  how_to_read: Compare to its own history and to inflation.
  moves_with: [boc.prime_rate, boc.gov_5y_yield]
licence_note: BoC terms apply. Verify before hosting.
verified_on: 2026-10-14
```

Explainers are written once, reviewed by the owner, and cached in the repo. They are not generated at request time.

## Conventions

- Never hard-code a source ID outside `catalogue/`.
- Ingestion is idempotent: re-running upserts observations.
- Each source client records `last_fetched_at` and the last observation date, and the front end shows both.
- Large StatCan tables (building permits exceeded 100 MB zipped) must not be downloaded in full. Resolve the vector IDs for the needed coordinates and use the WDS vector endpoints. This path has not been tested yet.
- Secrets live in `.env` (gitignored). `.env.example` lists the names only. Currently needed: `FRED_API_KEY`.
- Manual-entry files live in `data/manual/`. Commit only `*.template.csv` showing the columns.
- Python is run with `uv run`. Do not run interpreters from inside a directory that holds downloaded data.
- No em dashes in code comments, docs or commit messages.

## Hosting later (not designed yet)

- Static front end on any static host.
- Scheduled ingest (cron or CI) writing fresh JSON.
- Per-source licence review first. TRREB, some FRED series and any third-party data may not be redistributable. See DATA_SOURCES.md.
