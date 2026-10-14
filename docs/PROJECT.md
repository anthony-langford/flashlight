# Project brief

## Goal

Help one person (the owner) understand the Toronto housing market and the macro forces around it well enough to make a confident home purchase decision. It is a learning tool, not a trading tool or a listings site.

## User context

- Lives in Canada, planning to buy a home in Toronto.
- Purchase timeline: 3 months to 1 year (stated 2026-10-14). Near-term, so rates, listings, inventory and affordability matter more than long-run demographics.
- Property type: freehold, semi-detached or detached. Prioritise TRREB semi-detached and detached breakdowns and freehold benchmark prices. Condo and pre-construction data are lower priority.
- Financing (stated 2026-10-14): 35% down, first-time buyer, 30-year amortization. At 20% or more down the mortgage is uninsured, so there is no premium and the insured price cap does not apply, the lender sets the maximum amortization, and the stress test still applies. The plan relies on a lender program whose terms are unverified.
- Budget: $1.10M to $1.35M (stated 2026-10-14). Used for affordability defaults. It sits near insured-mortgage price and down payment thresholds, so those rules must be verified before the calculator is built (README list).
- Target areas (confirmed 2026-10-14): TRREB districts E01 and E02 (fit well), E03 (can work, school cutoffs close to Danforth Ave), W07 and W01. W08 excluded. Monarch Park and Sunnylea are school names, not TRREB communities, so the district list is the owner's choice. School quality data is a backlog item.
- Wants to run it locally first, host it later.
- Front end: React.

## Origin of the idea

The original idea was a general platform where anyone builds a dashboard of arbitrary data points, shares it, and uses an LLM to discover new relevant data points. A market scan (October 2026) found partial overlaps (DataSetIQ and Koyfin for macro dashboards, Knowi for AI-driven BI on private data, FRED as the free data baseline) but no self-serve tool combining thesis-driven series discovery, a live shareable dashboard and a fork/share layer. That general platform is a later possibility. The housing tool comes first and is built so the core can be reused.

## Scope

In scope (v1, Toronto housing):

- Toronto market conditions: prices, sales, listings, inventory, days on market
- Affordability: payment on live rates, price-to-income, closing costs including Toronto's double land transfer tax
- Rates and credit: policy rate, prime, GoC yields, mortgage rates, debt service
- Supply: starts, under construction, completions, permits, new housing price index
- Demand: population, employment, wages
- Rental market: rents and vacancy
- Canada macro context: CPI and core CPI, unemployment, USD/CAD, oil
- US inputs that feed Canadian rates: Fed funds, 10-year Treasury, 2s10s spread

Out of scope for now:

- China data. It was dropped from the housing tool on 2026-10-14 because the channel to Toronto is weak and indirect. It belongs to a separate Canada / US / China macro dashboard, a later topic pack.
- Hosting, user accounts, sharing, forking dashboards.
- LLM series discovery (planned after the core works, see README milestones).
- Individual listing data, MLS-level data.

## Design principles

1. **Explain, don't just plot.** Every series carries an explainer. A chart without context teaches little.
2. **State where data is stale.** Most series update monthly, quarterly or annually. Show the last observation date and the next expected release on every chart. No fake "live" feel.
3. **Causal claims are labelled.** Edges in the map carry a rationale and a confidence tag, and are checked against data where possible.
4. **Separate data from UI.** Ingestion, storage, catalogue and front end are independent so the project ports to hosting and to a second topic pack.
5. **Respect data licences.** Local personal use is fine for everything here. Anything hosted needs a per-source licence review. See DATA_SOURCES.md.

## Visualisation ideas (backlog)

Core (v1): causal map, percentile gauges, mortgage payment calculator on live rates, release calendar, Toronto overview page.

Later:

- Cycle overlays: align past episodes (2008, 2017 Fair Housing Plan, 2022 rate hikes) on one indexed chart
- Lead/lag explorer: slide one series against another to find the best lag and correlation
- Annotated timelines: policy events pinned to the price chart
- Toronto map: choropleth by district for price change, days on market, months of inventory
- Buyer vs seller market dial: composite of sales-to-new-listings, inventory and days on market, with a transparent formula
- Rent vs buy break-even chart with adjustable assumptions
- Glossary on hover for jargon
- Weekly "what changed" digest with each claim linked to its series

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-10-14 | Repo name is `flashlight` (owner's choice). Earlier suggestion `causeway` was not used. | Owner created the repo. |
| 2026-10-14 | React + TypeScript (Vite) front end from the start, not Streamlit. | Owner preference. |
| 2026-10-14 | Local first, static-site-friendly design (data exported as JSON files). | Easy to host later without a server. |
| 2026-10-14 | China excluded from the housing tool. | Weak channel to Toronto. Separate macro dashboard later. |
| 2026-10-14 | License is MIT for code. Data is not covered by it. | Permissive default. Source data has its own terms. |
| 2026-10-14 | Prioritise freehold (semi-detached, detached) and near-term indicators. Buyer timeline is 3 months to 1 year. | Owner's stated situation. |
| 2026-10-14 | TRREB data entered manually (or parsed from PDFs) for personal use. No redistribution. | No CSV or API found. Reports are copyrighted. |
