import { fmtDate, fmtMoneyCompact, fmtValue } from "./format";
import type {
  AppData,
  GraphData,
  GraphEdge,
  GraphNode,
  SeriesSummary,
} from "./types";
import { latestPeriod } from "./data";

export type Effect = "up" | "down" | "mixed";

export type Path = { nodes: string[]; edges: GraphEdge[] };

export type Impact = {
  node: string;
  effect: Effect;
  hops: number;
  paths: Path[];
};

const CONFIDENCE_RANK = { established: 3, plausible: 2, debated: 1 } as const;

/** The weakest confidence along a path. */
export function weakestConfidence(path: Path): GraphEdge["confidence"] {
  return path.edges.reduce<GraphEdge["confidence"]>(
    (w, e) => (CONFIDENCE_RANK[e.confidence] < CONFIDENCE_RANK[w] ? e.confidence : w),
    "established",
  );
}

/**
 * Trace an illustrative shock: every simple path from `start` (no node visited twice) up to
 * `maxDepth` edges, multiplying the edge signs. A node reached by paths of opposite sign is
 * "mixed". This is a tour of the claimed relationships, not a forecast.
 */
export function propagate(graph: GraphData, start: string, direction: 1 | -1, maxDepth = 6): Impact[] {
  const out = new Map<string, { signs: Set<number>; paths: Path[] }>();
  const edgesFrom = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) edgesFrom.set(e.from, [...(edgesFrom.get(e.from) ?? []), e]);

  const walk = (node: string, sign: number, nodes: string[], edges: GraphEdge[]) => {
    if (edges.length >= maxDepth) return;
    for (const e of edgesFrom.get(node) ?? []) {
      if (nodes.includes(e.to)) continue; // simple paths only, so feedback loops terminate
      const s = sign * (e.sign === "+" ? 1 : -1);
      const pathNodes = [...nodes, e.to];
      const pathEdges = [...edges, e];
      const entry = out.get(e.to) ?? { signs: new Set<number>(), paths: [] };
      entry.signs.add(s);
      entry.paths.push({ nodes: pathNodes, edges: pathEdges });
      out.set(e.to, entry);
      walk(e.to, s, pathNodes, pathEdges);
    }
  };
  walk(start, direction, [start], []);

  const order = new Map(graph.nodes.map((n, i) => [n.id, i]));
  return [...out.entries()]
    .map(([node, { signs, paths }]) => {
      const sorted = [...paths].sort((a, b) => a.edges.length - b.edges.length);
      const effect: Effect = signs.size > 1 ? "mixed" : signs.has(1) ? "up" : "down";
      return { node, effect, hops: sorted[0].edges.length, paths: sorted };
    })
    .sort((a, b) => a.hops - b.hops || (order.get(a.node) ?? 0) - (order.get(b.node) ?? 0));
}

export type Readout = {
  value: string;
  sub: string;
  trend: "up" | "down" | "flat" | null;
  percentile: number | null;
};

const FLAT_RELATIVE_CHANGE = 0.005;

export function trendOf(s: SeriesSummary): Readout["trend"] {
  if (s.yoy_pct !== null) return Math.abs(s.yoy_pct) < 0.25 ? "flat" : s.yoy_pct > 0 ? "up" : "down";
  if (s.change_1y_abs === null) return null;
  const rel = Math.abs(s.change_1y_abs) / Math.max(Math.abs(s.latest.value), 1e-9);
  return rel < FLAT_RELATIVE_CHANGE ? "flat" : s.change_1y_abs > 0 ? "up" : "down";
}

/** What to show on a node: the live value, its date, its direction and where it sits historically. */
export function nodeReadout(node: GraphNode, data: AppData): Readout | null {
  if (node.series) {
    const s = data.catalogue.find((c) => c.id === node.series);
    if (!s) return null;
    const isIndex = s.unit.toLowerCase().startsWith("index");
    const value =
      isIndex && s.yoy_pct !== null
        ? `${s.yoy_pct > 0 ? "+" : s.yoy_pct < 0 ? "−" : ""}${Math.abs(s.yoy_pct).toFixed(1)}% y/y`
        : fmtValue(s.latest.value, s.unit);
    return {
      value,
      sub: fmtDate(s.latest.date, s.frequency),
      trend: trendOf(s),
      percentile: s.percentile,
    };
  }
  const t = node.trreb;
  if (!t) return null;
  if (t.kind === "market") {
    const period = latestPeriod(data.market);
    const row = data.market.find((r) => r.area === t.area && r.home_type === t.home_type && r.period === period);
    const v = row && t.field ? (row as unknown as Record<string, number | null>)[t.field] : null;
    if (v === null || v === undefined) return null;
    return {
      value: t.field === "months_inventory" ? v.toFixed(1) : v.toLocaleString("en-CA"),
      sub: `${fmtDate(period, "monthly")}, 1 month so far`,
      trend: null,
      percentile: null,
    };
  }
  const period = latestPeriod(data.hpi);
  const row = data.hpi.find((r) => r.area === t.area && r.home_type === t.home_type && r.period === period);
  if (!row || row.benchmark === null) return null;
  const y = row.yoy_pct;
  return {
    value: fmtMoneyCompact(row.benchmark),
    sub: `${fmtDate(period, "monthly")}, 1 month so far`,
    trend: y === null ? null : Math.abs(y) < 0.25 ? "flat" : y > 0 ? "up" : "down",
    percentile: null,
  };
}

export const EVIDENCE_TEXT: Record<GraphEdge["evidence"]["status"], string> = {
  consistent: "Consistent with the claim",
  weak: "Weak relationship in the data",
  opposite: "Data point the other way",
  insufficient: "Not enough history to check",
  no_series: "No long data series to check",
};

export function evidenceDetail(e: GraphEdge): string {
  const ev = e.evidence;
  if ((ev.status === "consistent" || ev.status === "weak" || ev.status === "opposite") && ev.best_corr !== undefined) {
    const lag = ev.best_lag_months === 0 ? "the same month" : `${ev.best_lag_months} month${ev.best_lag_months === 1 ? "" : "s"} later`;
    return `Strongest link in monthly changes: correlation ${ev.best_corr.toFixed(2)}, ${lag} (${ev.pairs} months compared, best of lags 0 to ${e.max_lag_months}).`;
  }
  if (ev.status === "insufficient") {
    return `Only ${ev.overlap_months ?? 0} months of overlapping monthly data. At least 60 are needed, so no number is shown.`;
  }
  return "One or both ends have no data series with enough history, so the claim rests on the rationale alone.";
}

// --- Layout --------------------------------------------------------------------------------

export const NODE_W = 150;
export const NODE_H = 62;
export const COL_GAP = 76;
const ROW_STEP = 88;
const TOP = 44;
export const LEFT = 40; // room for first-column connections that bow out to the left
const RIGHT = 44; // room for connections that bow out beyond the last column

export function nodePos(n: GraphNode): { x: number; y: number } {
  return { x: LEFT + n.col * (NODE_W + COL_GAP), y: TOP + n.row * ROW_STEP };
}

export function canvasSize(g: GraphData): { w: number; h: number } {
  const maxRow = Math.max(...g.nodes.map((n) => n.row));
  return { w: LEFT + RIGHT + g.columns.length * NODE_W + (g.columns.length - 1) * COL_GAP, h: TOP + maxRow * ROW_STEP + NODE_H + 16 };
}

/**
 * SVG path and label point for an edge. Forward edges leave the right side and enter the left.
 * Backward edges leave the left side and enter the right. Edges inside one column bow out to the
 * side, down-going edges to the right and up-going edges to the left (always right in the last
 * column and left in the first, which have margins for it), so that pairs between the same rows do not overlap and long ones clear the nodes between.
 */
export function edgeGeometry(
  a: GraphNode,
  b: GraphNode,
  lastCol = Math.max(a.col, b.col),
): { d: string; mid: { x: number; y: number } } {
  const pa = nodePos(a);
  const pb = nodePos(b);
  if (a.col < b.col) {
    const x1 = pa.x + NODE_W, y1 = pa.y + NODE_H / 2, x2 = pb.x, y2 = pb.y + NODE_H / 2;
    const dx = (x2 - x1) / 2;
    return { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
  }
  if (a.col > b.col) {
    const x1 = pa.x, y1 = pa.y + NODE_H / 2, x2 = pb.x + NODE_W, y2 = pb.y + NODE_H / 2;
    const dx = (x1 - x2) / 2;
    return { d: `M${x1},${y1} C${x1 - dx},${y1} ${x2 + dx},${y2} ${x2},${y2}`, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
  }
  const down = b.row > a.row;
  const right = a.col === lastCol ? true : a.col === 0 ? false : down;
  const sx = right ? 1 : -1;
  const off = 26 + 6 * Math.max(Math.abs(b.row - a.row) - 1, 0);
  const x = right ? pa.x + NODE_W : pa.x;
  const y1 = pa.y + NODE_H / 2;
  const y2 = pb.y + NODE_H / 2;
  return {
    d: `M${x},${y1} C${x + sx * off},${y1} ${x + sx * off},${y2} ${x},${y2}`,
    mid: { x: x + sx * off * 0.75, y: (y1 + y2) / 2 },
  };
}
