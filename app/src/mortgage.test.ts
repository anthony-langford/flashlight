import { describe, expect, it } from "vitest";
import {
  ONTARIO_LTT,
  TORONTO_MLTT,
  calculate,
  minDownPayment,
  monthlyPayment,
  paymentGrid,
  premiumRate,
  qualifyingRate,
  transferTax,
  type Inputs,
} from "./mortgage";

// Expected values below were computed independently in Python, not with this module.

describe("transferTax", () => {
  it("is marginal and matches hand-checked values", () => {
    expect(transferTax(50_000, ONTARIO_LTT)).toBeCloseTo(250, 6);
    expect(transferTax(368_000, ONTARIO_LTT)).toBeCloseTo(3_995, 6);
    expect(transferTax(400_000, ONTARIO_LTT)).toBeCloseTo(4_475, 6);
    expect(transferTax(1_200_000, ONTARIO_LTT)).toBeCloseTo(20_475, 6);
    expect(transferTax(2_500_000, ONTARIO_LTT)).toBeCloseTo(48_975, 6);
  });
  it("Toronto and Ontario schedules agree up to $2M", () => {
    for (const p of [100_000, 400_000, 1_100_000, 1_350_000, 2_000_000]) {
      expect(transferTax(p, TORONTO_MLTT)).toBeCloseTo(transferTax(p, ONTARIO_LTT), 6);
    }
  });
});

describe("minDownPayment", () => {
  it("uses 5% / 10% tiers and 20% at the cap", () => {
    expect(minDownPayment(400_000)).toBe(20_000);
    expect(minDownPayment(500_000)).toBe(25_000);
    expect(minDownPayment(1_200_000)).toBe(95_000);
    expect(minDownPayment(1_350_000)).toBe(110_000);
    expect(minDownPayment(1_499_999)).toBeCloseTo(25_000 + 0.1 * 999_999, 4);
    expect(minDownPayment(1_500_000)).toBe(300_000);
  });
});

describe("premiumRate", () => {
  it("follows the CMHC bands, boundaries inclusive on the upper side", () => {
    expect(premiumRate(0.65)).toBe(0.006);
    expect(premiumRate(0.66)).toBe(0.017);
    expect(premiumRate(0.8)).toBe(0.024);
    expect(premiumRate(0.85)).toBe(0.028);
    expect(premiumRate(0.9)).toBe(0.031);
    expect(premiumRate(0.95)).toBe(0.04);
    expect(premiumRate(0.96)).toBeNull();
  });
});

describe("monthlyPayment", () => {
  it("matches independently computed values", () => {
    expect(monthlyPayment(1_000_000, 5, 25, "semiannual")).toBeCloseTo(5_816.05, 2);
    expect(monthlyPayment(1_000_000, 5, 25, "monthly")).toBeCloseTo(5_845.9, 2);
  });
  it("handles zero rate and zero loan", () => {
    expect(monthlyPayment(120_000, 0, 10)).toBeCloseTo(1_000, 6);
    expect(monthlyPayment(0, 5, 25)).toBe(0);
  });
});

describe("qualifyingRate", () => {
  it("is the greater of contract + 2 or 5.25", () => {
    expect(qualifyingRate(2.5)).toBeCloseTo(5.25, 9);
    expect(qualifyingRate(3.25)).toBeCloseTo(5.25, 9);
    expect(qualifyingRate(3.5)).toBeCloseTo(5.5, 9);
    expect(qualifyingRate(5)).toBeCloseTo(7, 9);
  });
});

const base: Inputs = {
  price: 1_200_000,
  down: 95_000,
  ratePct: 5,
  amortYears: 25,
  firstTimeBuyer: false,
  compounding: "semiannual",
  otherClosing: 0,
};

describe("calculate", () => {
  it("insured purchase at the minimum down payment", () => {
    const r = calculate(base);
    expect(r.insured).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.ltv).toBeCloseTo(0.9208, 4);
    expect(r.premiumRate).toBe(0.04);
    expect(r.premium).toBeCloseTo(44_200, 6);
    expect(r.loan).toBeCloseTo(1_149_200, 6);
    expect(r.monthly).toBeCloseTo(6_683.8, 1);
    expect(r.qualifyingRatePct).toBeCloseTo(7, 9);
    expect(r.qualifyingMonthly).toBeCloseTo(8_049.18, 1);
    expect(r.premiumTax).toBeCloseTo(3_536, 6);
    // down + Ontario tax + Toronto tax + sales tax on the premium
    expect(r.cashToClose).toBeCloseTo(95_000 + 20_475 + 20_475 + 3_536, 6);
  });

  it("30-year insured needs a first-time buyer and adds the 0.20% surcharge", () => {
    expect(calculate({ ...base, amortYears: 30 }).blockers).toHaveLength(1);
    const r = calculate({ ...base, amortYears: 30, firstTimeBuyer: true });
    expect(r.blockers).toEqual([]);
    expect(r.premiumRate).toBeCloseTo(0.042, 9);
    expect(r.premium).toBeCloseTo(46_410, 6);
    expect(r.monthly).toBeCloseTo(6_144.97, 1);
  });

  it("first-time buyer rebates are capped at the amounts and at the tax owed", () => {
    const r = calculate({ ...base, firstTimeBuyer: true });
    expect(r.ontarioRefund).toBe(4_000);
    expect(r.torontoRebate).toBe(4_475);
    const cheap = calculate({ ...base, price: 200_000, down: 40_000, firstTimeBuyer: true });
    expect(cheap.ontarioRefund).toBeCloseTo(cheap.ontarioTax, 9); // refund never exceeds the tax
    expect(cheap.torontoRebate).toBeCloseTo(cheap.torontoTax, 9);
  });

  it("20% down is uninsured with no premium or sales tax", () => {
    const r = calculate({ ...base, down: 240_000 });
    expect(r.insured).toBe(false);
    expect(r.premium).toBe(0);
    expect(r.premiumTax).toBe(0);
    expect(r.monthly).toBeCloseTo(5_583.41, 1);
    expect(r.qualifyingMonthly).toBeCloseTo(6_723.99, 1);
  });

  it("blocks a down payment under the minimum", () => {
    const r = calculate({ ...base, down: 90_000 });
    expect(r.blockers.join(" ")).toMatch(/below the minimum/);
  });

  it("blocks an insured purchase at the price cap", () => {
    const r = calculate({ ...base, price: 1_500_000, down: 200_000 });
    expect(r.blockers.join(" ")).toMatch(/20% down is required/);
  });

  it("always flags the unresolved price cap conflict for insured purchases", () => {
    expect(calculate(base).warnings.join(" ")).toMatch(/disagree/);
    expect(calculate({ ...base, down: 240_000 }).warnings.join(" ")).not.toMatch(/disagree/);
  });
});

describe("paymentGrid", () => {
  it("returns null where a purchase is not possible and respects the minimum down payment", () => {
    const grid = paymentGrid({ ...base, down: 240_000 }, [1_200_000, 1_600_000], [4, 5]);
    expect(grid[0].payments.every((p) => p !== null)).toBe(true);
    // 1.6M needs 20% and the share is 20%, so it is valid, and costs more than the 1.2M row
    expect(grid[1].payments[1]!).toBeGreaterThan(grid[0].payments[1]!);
  });
  it("payments rise with the rate", () => {
    const [row] = paymentGrid({ ...base, down: 240_000 }, [1_200_000], [4, 5, 6, 7]);
    const p = row.payments as number[];
    expect(p[0]).toBeLessThan(p[1]);
    expect(p[1]).toBeLessThan(p[2]);
    expect(p[2]).toBeLessThan(p[3]);
  });
});

describe("Ontario page closed forms", () => {
  // The Ontario land transfer tax page gives these formulas, an independent check on the brackets.
  it("matches VOC x 0.02 - 3,525 from $400K to $2M and VOC x 0.025 - 13,525 above", () => {
    for (const p of [400_000, 650_000, 1_100_000, 1_225_000, 1_350_000, 2_000_000]) {
      expect(transferTax(p, ONTARIO_LTT)).toBeCloseTo(p * 0.02 - 3_525, 6);
    }
    for (const p of [2_000_001, 2_500_000, 3_000_000]) {
      expect(transferTax(p, ONTARIO_LTT)).toBeCloseTo(p * 0.025 - 13_525, 6);
    }
  });
});
