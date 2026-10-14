import { describe, expect, it } from "vitest";
import { niceInterval, niceRange } from "./TrendGrid";

describe("niceInterval", () => {
  it("picks 1, 2 or 5 times a power of ten", () => {
    expect(niceInterval(20, 4)).toBe(5);
    expect(niceInterval(100, 4)).toBe(20);
    expect(niceInterval(9, 4)).toBe(2);
    expect(niceInterval(0.8, 4)).toBeCloseTo(0.2, 9);
    expect(niceInterval(0)).toBe(1);
  });
});

describe("niceRange", () => {
  it("rounds outward to the tick spacing and includes reference values", () => {
    const r = niceRange([96, 114], [100]);
    expect(r.interval).toBe(5);
    expect(r.min).toBe(95);
    expect(r.max).toBe(115);
    expect(niceRange([3, 14], [0]).min).toBe(0);
  });
  it("handles no data and a single value", () => {
    expect(niceRange([])).toEqual({ min: 0, max: 1, interval: 1 });
    const r = niceRange([42]);
    expect(r.min).toBeLessThanOrEqual(42);
    expect(r.max).toBeGreaterThanOrEqual(42);
  });
});

import { LABEL_GAP } from "./TrendGrid";

describe("LABEL_GAP", () => {
  it("is a small share of the axis, so only genuinely close end labels are suppressed", () => {
    expect(LABEL_GAP).toBeGreaterThan(0);
    expect(LABEL_GAP).toBeLessThan(0.25);
  });
});
