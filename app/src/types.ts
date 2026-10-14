export type Explainer = {
  what: string;
  why_it_matters: string;
  how_to_read: string;
  moves_with: string[];
};

export type SeriesSummary = {
  id: string;
  title: string;
  source: string;
  source_id: string;
  source_ref: string | null;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  unit: string;
  geography: string;
  layer: string;
  seasonal_adj: boolean | null;
  explainer: Explainer | null;
  licence_note: string | null;
  verified_on: string | null;
  first_obs: string;
  n_obs: number;
  latest: { date: string; value: number };
  stale_days: number;
  change_1y_abs: number | null;
  yoy_pct: number | null;
  percentile: number;
};

export type SeriesData = {
  id: string;
  obs: [string, number][];
  yoy: [string, number][] | null;
};

export type TargetArea = {
  name: string;
  side: "east" | "west";
  districts: string[];
  confidence: "confident" | "unconfirmed";
  note: string;
};

export type Buyer = {
  budget: { min: number; max: number };
  timeline: string;
  property_types: string[];
  target_areas: TargetArea[];
  district_labels: Record<string, string>;
};

export type Meta = { generated_at: string; series: number; trreb_rows: number; hpi_rows: number };

type Cell = string | number | null;

export type TrrebRaw = {
  market_columns: string[];
  market: Cell[][];
  hpi_columns: string[];
  hpi: Cell[][];
};

export type MarketRow = {
  period: string;
  area: string;
  home_type: string;
  sales: number | null;
  avg_price: number | null;
  median_price: number | null;
  new_listings: number | null;
  active_listings: number | null;
  months_inventory: number | null;
  sp_lp: number | null;
  ldom: number | null;
};

export type HpiRow = {
  period: string;
  area: string;
  home_type: string;
  index: number | null;
  benchmark: number | null;
  yoy_pct: number | null;
};

export type EdgeEvidence = {
  status: "consistent" | "weak" | "opposite" | "insufficient" | "no_series";
  best_lag_months?: number;
  best_corr?: number;
  corr_at_zero?: number | null;
  pairs?: number;
  overlap_months?: number;
};

export type GraphNode = {
  id: string;
  label: string;
  col: number;
  row: number;
  series: string | null;
  trreb: { kind: "market" | "hpi"; area: string; home_type: string; field: string | null } | null;
};

export type GraphEdge = {
  from: string;
  to: string;
  sign: "+" | "-";
  lag: string;
  max_lag_months: number;
  confidence: "established" | "plausible" | "debated";
  review: "draft" | "reviewed";
  rationale: string;
  evidence: EdgeEvidence;
};

export type GraphData = { columns: string[]; nodes: GraphNode[]; edges: GraphEdge[] };

export type AppData = {
  meta: Meta;
  graph: GraphData;
  buyer: Buyer;
  catalogue: SeriesSummary[];
  market: MarketRow[];
  hpi: HpiRow[];
};
