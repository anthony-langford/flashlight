# Causal map

The causal map is the backbone of the app and the main way it teaches. This doc defines the design. Seed content below is a first draft from general economic reasoning. It has NOT been reviewed by the owner or tested against data.

## Principles

- Edges are claims, not facts. Each has a sign, a typical lag, a strength, a one or two sentence rationale, and a confidence tag.
- Confidence tags: `established` (standard mechanism, widely documented), `plausible` (reasonable, mixed evidence), `debated` (contested or regime-dependent).
- An LLM may draft edges, but the owner reviews them. Unreviewed edges are shown as `draft` and visibly styled differently.
- Where data allows, an edge links to a lead/lag chart of its two series so the claim can be inspected.

## Schema

`graph/nodes.yaml`

```yaml
- id: gov_5y_yield
  label: GoC 5-year yield
  series: boc.gov_5y_yield     # optional, concept nodes have none
  layer: rates_credit
  kind: indicator              # indicator | concept | policy | shock
```

`graph/edges.yaml`

```yaml
- from: gov_5y_yield
  to: mortgage_fixed_rate
  sign: "+"
  lag: "days to weeks"
  strength: strong
  confidence: established
  review: draft                # draft | reviewed
  rationale: >
    Lenders fund fixed mortgages with bond-market money, so fixed rates track
    the 5-year yield plus a margin.
  evidence: null               # optional pointer to a lead/lag chart config
```

## Front-end behaviour

- Nodes show the latest value, the percentile vs history and a sparkline. Colour encodes recent state (rising, falling, extreme).
- Click a node: live chart, explainer, inbound and outbound edges.
- Click an edge: rationale, lag, confidence, and the lead/lag chart if available.
- Shock mode: choose a node and a direction (for example, policy rate down 50 bps). Highlight downstream paths, ordered by typical lag, with the confidence of each hop. This is illustrative, not a forecast, and the UI must say so.
- Filters: layer, confidence level, reviewed only.

## Seed nodes (draft, about 18)

Policy and rates: `fed_policy`, `ust_10y`, `boc_policy_rate`, `prime_rate`, `gov_5y_yield`, `mortgage_fixed_rate`, `mortgage_variable_rate`
Macro: `us_economy`, `usdcad`, `oil_price`, `cpi_core`, `toronto_employment`, `wages`
Housing demand: `population_growth`, `buyer_payment_capacity`, `sales`
Housing supply and prices: `new_listings`, `inventory_months`, `prices`, `rents`, `starts`

## Seed edges (draft)

| From | To | Sign | Lag | Confidence | Rationale |
|---|---|---|---|---|---|
| fed_policy | ust_10y | + | immediate to months | plausible | Policy expectations feed the yield curve, but long yields also reflect term premium. |
| ust_10y | gov_5y_yield | + | days | established | Global bond markets are linked. Canadian yields co-move with US yields. |
| boc_policy_rate | prime_rate | + | immediate | established | Banks set prime at a fixed spread above the policy rate. |
| boc_policy_rate | mortgage_variable_rate | + | immediate | established | Variable rates are priced off prime. |
| boc_policy_rate | gov_5y_yield | + | days to months | plausible | Expected path of policy feeds the 5-year yield, but the market moves ahead of decisions. |
| gov_5y_yield | mortgage_fixed_rate | + | days to weeks | established | Fixed mortgages are funded off bond-market money. |
| mortgage_fixed_rate | buyer_payment_capacity | - | immediate | established | Higher rates raise the payment on a given loan, cutting borrowing power. |
| buyer_payment_capacity | sales | + | 1-3 months | established | Less purchasing power means fewer transactions. |
| sales | inventory_months | - | 1-3 months | established | Slower sales leave more unsold stock relative to sales pace. |
| new_listings | inventory_months | + | immediate | established | More supply entering the market. |
| inventory_months | prices | - | 3-12 months | established | More supply relative to demand shifts leverage to buyers. |
| prices | new_listings | + | months | plausible | Rising prices can pull owners to list, but price falls can also trigger forced sales. |
| population_growth | rents | + | 6-18 months | plausible | More households chase rental stock, especially where supply is tight. |
| rents | sales | + | months | debated | Higher rents can push renters to buy, or price them out. Direction is regime-dependent. |
| toronto_employment | buyer_payment_capacity | + | months | plausible | Job and wage growth support income and confidence. |
| cpi_core | boc_policy_rate | + | months | established | The Bank targets inflation, so persistent core inflation raises policy rates. |
| oil_price | usdcad | - | immediate | plausible | Canada is a commodity exporter, so oil strength tends to lift the Canadian dollar. Relationship varies over time. |
| starts | inventory_months | + | 18-36 months | plausible | Completions add supply after a long construction lag, especially for condos. |

All rows are `review: draft` until the owner marks them reviewed.

## Evidence plan

For each edge with two data series, compute lagged correlation (and rolling correlation to check stability) on first differences or percentage changes, not levels. Present results as "consistent with" or "not supported", never as proof. Record the method and date in the edge's `evidence` field.
