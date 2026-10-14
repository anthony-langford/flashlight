# Roadmap and handoff

Last updated: 2026-10-14. Update this file at the end of every working session.

## How to resume (new chat, fork or agent)

1. Read AGENTS.md, then this file, then PROJECT.md.
2. Check "Status" below for what exists. Check `git log` and the working tree for anything newer than this file.
3. Pick the first unchecked milestone. Do not redo anything marked verified unless the verification date is stale and the data matters.
4. Before ending, update Status, Open questions and the decisions log in PROJECT.md.

## Status

- [x] Idea explored, market scan done, scope agreed (see PROJECT.md)
- [x] Data source feasibility checked (see DATA_SOURCES.md)
- [x] Repo created, README, LICENSE, .gitignore, docs written and committed to `main`
- [x] FRED API key obtained and stored in local `.env` (gitignored, never commit it)
- [ ] Python project scaffolded (`uv`, `ingest/` package, tests)
- [ ] Catalogue YAML for the v1 series
- [ ] Source clients: BoC Valet, FRED, StatCan
- [ ] DuckDB schema and loaders
- [ ] Export step to JSON
- [ ] React app scaffolded (Vite, TypeScript)
- [ ] First views and causal map

## Milestones

**M1: Data foundation** (next)
- Scaffold Python project with `uv`. Add `.env.example` with `FRED_API_KEY`.
- Write catalogue entries for the verified series in DATA_SOURCES.md (BoC, FRED, StatCan Toronto).
- Implement the BoC Valet client first (no key, simplest), then FRED, then StatCan.
- For StatCan: resolve vector IDs per series via metadata and use WDS vector endpoints. Test this path. Fall back to the full-table CSV only for small tables.
- DuckDB schema per ARCHITECTURE.md. Idempotent upserts. Tests for each client using recorded fixtures.
- Manual-entry templates in `data/manual/` for TRREB and CMHC rent.

**M2: Export and first UI**
- Export normalised series to `app/public/data/`.
- Scaffold the React app. Series page with ECharts line chart, last-updated label and explainer.
- Percentile gauges.

**M3: Causal map**
- `graph/` YAML loader, React Flow view, node state colouring, node and edge panels.
- Owner reviews seed edges (CAUSAL_MAP.md). Mark reviewed.
- Lead/lag evidence charts for edges with data.

**M4: Housing tools**
- Mortgage payment calculator on live rates with sensitivity grid.
- Toronto overview page. Release calendar.
- Land transfer tax and closing cost estimator (verify Toronto double LTT rules from official sources first).

**M5: Discovery and polish**
- LLM-assisted "suggest more indicators for X" flow, with suggestions checked against real, fetchable series before display.
- Weekly "what changed" digest with claims linked to series.
- Hosting review: licences per source, scheduled ingest.

## Open questions for the owner

- Target areas (416 vs 905, specific districts or neighbourhoods)? This decides which TRREB districts to prioritise for semi-detached and detached.
- Budget range? Used for the affordability calculator defaults. Optional.
- How should TRREB data be captured: manual monthly entry, or build a PDF parser?

Answered (2026-10-14): timeline is 3 months to 1 year. Property type is freehold, semi-detached or detached. A FRED API key was provided and stored in the gitignored `.env`.

## Open data items

See "Known gaps and open items" in DATA_SOURCES.md. Highest priority: Toronto population components, mortgage stress test rule verification, WDS vector endpoint test, CMHC workbook inspection.

## Session log

| Date | Summary |
|---|---|
| 2026-10-14 | Explored idea and market. Chose scope (Toronto housing, no China). Verified BoC, StatCan, FRED series and Toronto coverage. Found CMHC and TRREB are file-based only. Created repo docs. No application code yet. |
