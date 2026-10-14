import { describe, expect, it } from "vitest";
import { sharedRange } from "./HpiTrend";

describe("sharedRange", () => {
  const budget = { min: 1_100_000, max: 1_350_000 };
  it("rounds outward to $200K steps and always includes the budget band", () => {
    expect(sharedRange([1_060_000, 2_020_000], budget)).toEqual({ min: 1_000_000, max: 2_200_000 });
    // data entirely inside the budget band still shows the whole band
    expect(sharedRange([1_200_000], budget)).toEqual({ min: 1_000_000, max: 1_400_000 });
  });
  it("is stable for exact multiples", () => {
    expect(sharedRange([1_200_000, 1_800_000], { min: 1_200_000, max: 1_400_000 })).toEqual({
      min: 1_200_000,
      max: 1_800_000,
    });
  });
});
