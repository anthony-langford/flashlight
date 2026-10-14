import type {
  AppData,
  Buyer,
  GraphData,
  HpiRow,
  MarketRow,
  Meta,
  SeriesData,
  SeriesSummary,
  TrrebRaw,
} from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`data/${path}`);
  if (!res.ok) throw new Error(`Could not load data/${path} (${res.status}). Run the export step.`);
  return (await res.json()) as T;
}

function rowsToObjects<T>(columns: string[], rows: (string | number | null)[][]): T[] {
  return rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])) as T);
}

export function parseTrreb(raw: TrrebRaw): { market: MarketRow[]; hpi: HpiRow[] } {
  return {
    market: rowsToObjects<MarketRow>(raw.market_columns, raw.market),
    hpi: rowsToObjects<HpiRow>(raw.hpi_columns, raw.hpi),
  };
}

export async function loadAll(): Promise<AppData> {
  const [meta, buyer, catalogue, trreb, graph] = await Promise.all([
    getJson<Meta>("meta.json"),
    getJson<Buyer>("buyer.json"),
    getJson<SeriesSummary[]>("catalogue.json"),
    getJson<TrrebRaw>("trreb.json"),
    getJson<GraphData>("graph.json"),
  ]);
  return { meta, buyer, catalogue, graph, ...parseTrreb(trreb) };
}

const seriesCache = new Map<string, Promise<SeriesData>>();

export function loadSeries(id: string): Promise<SeriesData> {
  let p = seriesCache.get(id);
  if (!p) {
    p = getJson<SeriesData>(`series/${id}.json`);
    seriesCache.set(id, p);
  }
  return p;
}

export type RangeKey = "1Y" | "5Y" | "10Y" | "All";
export const RANGES: RangeKey[] = ["1Y", "5Y", "10Y", "All"];

/** Keep observations within the last N years of the final observation. */
export function sliceRange<T extends [string, number]>(obs: T[], range: RangeKey): T[] {
  if (range === "All" || obs.length === 0) return obs;
  const years = range === "1Y" ? 1 : range === "5Y" ? 5 : 10;
  const [y, m, d] = obs[obs.length - 1][0].split("-").map(Number);
  const cutoff = `${String(y - years).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return obs.filter(([date]) => date >= cutoff);
}

export const LAYER_LABELS: Record<string, string> = {
  rates_credit: "Rates and credit",
  toronto_market: "Toronto market",
  affordability: "Affordability",
  supply: "Supply",
  demand: "Demand",
  rental: "Rental market",
  canada_macro: "Canada macro",
  us_inputs: "US inputs",
};

export const LAYER_ORDER = [
  "rates_credit",
  "toronto_market",
  "supply",
  "demand",
  "rental",
  "canada_macro",
  "us_inputs",
  "affordability",
];

export function latestPeriod(rows: { period: string }[]): string {
  return rows.reduce((max, r) => (r.period > max ? r.period : max), "");
}

/**
 * Row for one district and home type in a given period (default: the newest period overall).
 * Never falls back to an older month, so a table headed "September" cannot show August.
 */
export function districtRow(
  market: MarketRow[],
  district: string,
  homeType: string,
  period: string = latestPeriod(market),
): MarketRow | undefined {
  const area = `Toronto ${district}`;
  return market.find((r) => r.area === area && r.home_type === homeType && r.period === period);
}

export function districtHpi(
  hpi: HpiRow[],
  district: string,
  homeType: string,
  period: string = latestPeriod(hpi),
): HpiRow | undefined {
  const area = `Toronto ${district}`;
  return hpi.find((r) => r.area === area && r.home_type === homeType && r.period === period);
}

/** Ordered list of districts across all target areas, without duplicates. */
export function targetDistricts(buyer: Buyer): string[] {
  const seen: string[] = [];
  for (const area of buyer.target_areas) for (const d of area.districts) if (!seen.includes(d)) seen.push(d);
  return seen.sort((a, b) => a.localeCompare(b));
}
