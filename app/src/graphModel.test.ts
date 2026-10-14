import { describe, expect, it } from "vitest";
import { canvasSize, edgeGeometry, nodePos, propagate, trendOf, weakestConfidence } from "./graphModel";
import type { GraphData, GraphEdge, GraphNode, SeriesSummary } from "./types";

const node = (id: string, col: number, row = 0): GraphNode => ({ id, label: id, col, row, series: null, trreb: null });
const edge = (from: string, to: string, sign: "+" | "-", confidence: GraphEdge["confidence"] = "established"): GraphEdge => ({
  from, to, sign, lag: "x", max_lag_months: 3, confidence, review: "draft", rationale: "r",
  evidence: { status: "no_series" },
});

describe("propagate", () => {
  const g: GraphData = {
    columns: ["a", "b", "c", "d"],
    nodes: [node("rate", 0), node("payment", 1), node("sales", 2), node("inventory", 3)],
    edges: [edge("rate", "payment", "-"), edge("payment", "sales", "+"), edge("sales", "inventory", "-")],
  };

  it("multiplies signs along a chain", () => {
    const up = propagate(g, "rate", 1);
    expect(up.map((i) => [i.node, i.effect])).toEqual([
      ["payment", "down"],
      ["sales", "down"],
      ["inventory", "up"],
    ]);
    const down = propagate(g, "rate", -1);
    expect(down.map((i) => i.effect)).toEqual(["up", "up", "down"]);
  });

  it("reports hops and orders by distance", () => {
    expect(propagate(g, "rate", 1).map((i) => i.hops)).toEqual([1, 2, 3]);
  });

  it("flags nodes reached by opposite-sign paths as mixed", () => {
    const m: GraphData = {
      ...g,
      nodes: [node("a", 0), node("b", 1), node("c", 1, 1), node("d", 2)],
      edges: [edge("a", "b", "+"), edge("a", "c", "+"), edge("b", "d", "+"), edge("c", "d", "-")],
    };
    expect(propagate(m, "a", 1).find((i) => i.node === "d")?.effect).toBe("mixed");
  });

  it("survives feedback loops and never lists the starting node", () => {
    const loop: GraphData = {
      ...g,
      nodes: [node("a", 0), node("b", 1), node("c", 2)],
      edges: [edge("a", "b", "+"), edge("b", "c", "+"), edge("c", "a", "+")],
    };
    const r = propagate(loop, "a", 1);
    expect(r.map((i) => i.node)).toEqual(["b", "c"]);
  });

  it("respects the depth limit and handles isolated nodes", () => {
    expect(propagate(g, "rate", 1, 2).map((i) => i.node)).toEqual(["payment", "sales"]);
    expect(propagate(g, "inventory", 1)).toEqual([]);
  });
});

describe("weakestConfidence", () => {
  it("returns the least certain edge on the path", () => {
    const p = { nodes: ["a", "b", "c"], edges: [edge("a", "b", "+", "established"), edge("b", "c", "+", "debated")] };
    expect(weakestConfidence(p)).toBe("debated");
  });
});

describe("trendOf", () => {
  const s = (over: Partial<SeriesSummary>): SeriesSummary => ({ latest: { date: "2026-01-01", value: 100 }, yoy_pct: null, change_1y_abs: null, ...over }) as SeriesSummary;
  it("uses year-over-year for index series with a dead zone", () => {
    expect(trendOf(s({ yoy_pct: 3 }))).toBe("up");
    expect(trendOf(s({ yoy_pct: -3 }))).toBe("down");
    expect(trendOf(s({ yoy_pct: 0.1 }))).toBe("flat");
  });
  it("treats tiny relative changes as flat", () => {
    expect(trendOf(s({ latest: { date: "x", value: 7_100_000 }, change_1y_abs: -992 }))).toBe("flat");
    expect(trendOf(s({ latest: { date: "x", value: 2.25 }, change_1y_abs: -0.25 }))).toBe("down");
    expect(trendOf(s({}))).toBeNull();
  });
});

describe("layout", () => {
  it("places columns left to right and sizes the canvas to fit every node", () => {
    const g: GraphData = { columns: ["a", "b"], nodes: [node("x", 0, 0), node("y", 1, 2)], edges: [] };
    const { w, h } = canvasSize(g);
    for (const n of g.nodes) {
      const p = nodePos(n);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + 150).toBeLessThanOrEqual(w);
      expect(p.y + 62).toBeLessThanOrEqual(h);
    }
    expect(nodePos(g.nodes[1]).x).toBeGreaterThan(nodePos(g.nodes[0]).x);
  });
  it("routes forward, backward and vertical edges from the matching sides", () => {
    const a = node("a", 0, 0), b = node("b", 1, 1), c = node("c", 0, 2);
    expect(edgeGeometry(a, b).d.startsWith(`M${nodePos(a).x + 150},`)).toBe(true);
    expect(edgeGeometry(b, a).d.startsWith(`M${nodePos(b).x},`)).toBe(true);
    // inside one column the edge bows out sideways instead of running through nodes between
    const down = edgeGeometry(a, c, 1);
    // middle columns: down-going bows right, up-going bows left
    const mid = (r: number) => ({ id: "m", label: "m", col: 1, row: r, series: null, trreb: null });
    const downMid = edgeGeometry(mid(0), mid(2), 5);
    const upMid = edgeGeometry(mid(2), mid(0), 5);
    expect(downMid.mid.x).toBeGreaterThan(nodePos(mid(0)).x + 150);
    expect(upMid.mid.x).toBeLessThan(nodePos(mid(0)).x);
    // first column bows left into the margin, so it stays clear of the gap on its right
    expect(down.d.startsWith(`M${nodePos(a).x},`)).toBe(true);
    expect(down.mid.x).toBeLessThan(nodePos(a).x);
    expect(down.mid.x).toBeGreaterThanOrEqual(0);
    // in the last column everything bows right into the right margin
    expect(edgeGeometry(c, a, 0).mid.x).toBeGreaterThan(nodePos(a).x + 150);
  });
});
