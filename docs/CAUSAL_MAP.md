# Causal map

The causal map is the backbone of the app and the main way it teaches. **The source of truth is `graph/nodes.yaml` and `graph/edges.yaml`.** This doc explains the design and how to review it. It does not duplicate the edges.

## Principles

- Edges are claims, not facts. Each has a sign, a typical lag, a confidence tag and a rationale.
- Confidence tags: `established` (standard mechanism, widely documented), `plausible` (reasonable, mixed evidence), `debated` (contested or regime-dependent).
- Every edge is `review: draft` until the owner reviews it. Drafts are drawn dashed. When you review an edge, set `review: reviewed`, which draws it solid.
- A data check sits beside each claim, but it never replaces the rationale and it is not proof of causation.

## Files

`graph/nodes.yaml` lists the display `columns` and the nodes. A node places itself with `col` and `row`, and shows live data from at most one source: a catalogue `series`, or a `trreb` reference (a market column or an HPI benchmark, one month of history so far). A node with neither is a concept, such as buyer payment capacity.

`graph/edges.yaml` lists the edges: `from`, `to`, `sign` (`"+"` same direction, `"-"` opposite), `lag` (text shown to the reader), `max_lag_months` (how far the data check searches), `confidence`, `review` and `rationale`.

`ingest/graph.py` validates both files with pydantic: unique node ids, edge endpoints exist, no duplicate or self edges, every node column is declared, and every `series` exists in the catalogue. `tests/test_graph.py` checks the real graph and the data check.

## The data check

For each edge where both ends have a data series, the export computes, on **monthly changes** (a difference for rates, a percent change for levels, so that two trending levels do not produce a false link):

1. Resample each series to months, keeping the last reading in each month.
2. Correlate the source's change in month t with the target's change in month t + lag, for lags 0 to `max_lag_months` (the source leads).
3. Keep the lag with the strongest correlation, and label the edge:
   - `consistent`: |r| clears the significance floor and the sign matches the claim.
   - `weak`: |r| is below the floor, so it cannot be told apart from chance.
   - `opposite`: |r| clears the floor but the sign is the other way.

   The floor is the larger of 0.15 and 2 / sqrt(pairs), which is about 0.19 for 117 months of history, 0.37 for 30 months. A short history throws up sizeable correlations by chance, so the same number means less with 30 months than with 300.
   - `insufficient`: fewer than 24 overlapping months (annual series always land here).
   - `no_series`: one end is a concept with no data.

   With 60 or more overlapping months the full lag search runs. With 24 to 59 months the result is marked **preliminary** and only lags up to 3 months are tried, because many lags on a short history mostly find noise. TRREB nodes (history from January 2024, about 30 months of changes) are in this tier.

Searching several lags and keeping the best flatters the result a little, so read "consistent" as "does not contradict", not as strong support. Several of these series are also not seasonally adjusted, so a shared seasonal cycle can look like a link. Results as of 2026-10-14 (19 edges), recompute with `uv run python -m ingest export`:

- Full history, consistent: US 10-year to GoC 5-year yield (r 0.79), policy rate to prime (0.89), prime to variable mortgage (0.84), GoC 5-year to posted fixed rate (0.36), core inflation to policy rate (0.22 at 9 months), oil to USD/CAD (-0.29), and two weak but above-floor links: Fed rate to US 10-year (0.18) and policy rate to 5-year yield (0.18).
- Preliminary (about 30 months, TRREB history from January 2024): all six edges that touch the Toronto market series read **no clear relationship**: sales to inventory, new listings to inventory, housing starts to inventory, months of inventory to prices, prices to new listings and rents to sales. None clears the floor of about 0.35 to 0.38, so the data neither support nor contradict those claims yet. In particular the rents-to-sales edge, marked debated, is not contradicted: an earlier version of this check reported it as pointing the other way, which was noise.
- Not checkable: population to rents (annual data) and the four edges through the concept node buyer payment capacity.

With more months the preliminary edges will become checkable. Do not read any housing-chain edge as supported or contradicted by the data yet.

## How the app uses it

- Nodes show the latest value, the direction over the past year, and where the reading sits in its own history (P90 means 90% of past readings were at or below it). Colour is never the only signal: edges carry a + or − badge, line width shows confidence and dashes show draft.
- Click a node for its chart, explainer and its inbound and outbound connections. Click an edge for the rationale, timing, confidence and data check. Every node and edge is keyboard focusable, and a table lists all connections.
- **Trace a shock** picks a node and a direction, follows every simple path out of it (no node twice, at most six steps), and multiplies the signs along each path. A node reached by paths of opposite sign is labelled mixed. It is illustrative, not a forecast: it ignores size, overlapping timing and everything outside the map, and the UI says so.
- Views can be linked: `#/map?node=gov_5y_yield`, `#/map?edge=5`, `#/map?shock=boc_policy_rate&dir=up`.

## Reviewing the edges (owner task)

For each edge in `graph/edges.yaml`, read the rationale and confidence. Change anything you disagree with, then set `review: reviewed`. Pay most attention to the `debated` edge (`rents` to `sales`) and to the `plausible` ones. The data cannot help with them yet. Weak points I already know about:

- `starts` to `inventory_months` uses CMHC starts for all unit types, mostly apartments, so it says little about freehold supply.
- `unemployment` to `buyer_payment_capacity` is a concept link with no data check.
- `mortgage_fixed_rate` uses the posted 5-year rate as a proxy, which buyers rarely pay.
- The map has no edge for immigration policy or for the stress test, both of which plausibly matter. Add them if you agree.
