import { describe, expect, it } from "vitest";
import { COST_ITEMS, EXCLUDED, HST_RATE, REGISTRATIONS, REGISTRATION_FEE, estimateClosingCosts } from "./closingCosts";

describe("estimateClosingCosts", () => {
  const e = estimateClosingCosts();

  it("keeps every item ordered low, typical, high, and the totals add up", () => {
    for (const i of COST_ITEMS) {
      expect(i.low).toBeLessThanOrEqual(i.typical);
      expect(i.typical).toBeLessThanOrEqual(i.high);
    }
    expect(e.low).toBe(COST_ITEMS.reduce((a, i) => a + i.low, 0));
    expect(e.typical).toBe(COST_ITEMS.reduce((a, i) => a + i.typical, 0));
    expect(e.high).toBe(COST_ITEMS.reduce((a, i) => a + i.high, 0));
    expect(e.low).toBeLessThan(e.typical);
    expect(e.typical).toBeLessThan(e.high);
  });

  it("adds Ontario HST to the lawyer's fees", () => {
    const legal = COST_ITEMS.find((i) => i.key === "legal")!;
    expect(HST_RATE).toBe(0.13);
    expect(legal.low).toBe(Math.round(1500 * 1.13)); // 1,695
    expect(legal.typical).toBe(2260);
    expect(legal.high).toBe(2825);
  });

  it("registers two documents at the official fee", () => {
    const reg = COST_ITEMS.find((i) => i.key === "registration")!;
    expect(REGISTRATIONS).toBe(2);
    expect(REGISTRATION_FEE).toBe(85);
    expect(reg.low).toBe(170);
    expect(reg.typical).toBe(170);
    expect(reg.high).toBeGreaterThan(170);
  });

  it("produces the documented figures", () => {
    // typical: 2,260 legal + 170 registration + 650 title + 500 inspection + 300 appraisal
    // high: 2,825 + 174 + 1,000 + 600 + 350
    expect(e.typical).toBe(3_880);
    expect(e.low).toBe(2_515);
    expect(e.high).toBe(4_949);
  });

  it("does not count land transfer tax or sales tax on the insurance premium", () => {
    const keys = COST_ITEMS.map((i) => i.key).join(" ");
    expect(keys).not.toMatch(/transfer|premium/i);
  });

  it("is honest about the basis of each figure and about what is left out", () => {
    expect(COST_ITEMS.find((i) => i.key === "title")!.basis).toBe("assumption");
    expect(COST_ITEMS.find((i) => i.key === "legal")!.basis).toBe("commercial");
    expect(COST_ITEMS.find((i) => i.key === "registration")!.basis).toBe("official");
    expect(EXCLUDED.map((x) => x.label).join(" ")).toMatch(/adjustments/);
    for (const i of COST_ITEMS) expect(i.source.length).toBeGreaterThan(20);
  });
});
