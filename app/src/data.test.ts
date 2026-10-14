import { describe, expect, it } from "vitest";
import { districtHpi, districtRow, parseTrreb, sliceRange, targetDistricts } from "./data";
import type { Buyer } from "./types";

describe("sliceRange", () => {
  const obs: [string, number][] = [
    ["2015-06-01", 1],
    ["2022-06-01", 2],
    ["2025-10-01", 3],
    ["2026-06-01", 4],
  ];
  it("keeps the last N years from the final observation", () => {
    expect(sliceRange(obs, "1Y").map(([, v]) => v)).toEqual([3, 4]);
    expect(sliceRange(obs, "5Y").map(([, v]) => v)).toEqual([2, 3, 4]);
    expect(sliceRange(obs, "All")).toHaveLength(4);
  });
  it("handles empty input", () => {
    expect(sliceRange([], "1Y")).toEqual([]);
  });
});

describe("TRREB helpers", () => {
  const { market, hpi } = parseTrreb({
    market_columns: ["period", "area", "home_type", "sales", "avg_price"],
    market: [
      ["2026-08-01", "Toronto E01", "detached", 10, 1_400_000],
      ["2026-09-01", "Toronto E01", "detached", 13, 1_506_231],
      ["2026-09-01", "Toronto E01", "semi_detached", 28, 1_286_913],
    ],
    hpi_columns: ["period", "area", "home_type", "index", "benchmark", "yoy_pct"],
    hpi: [["2026-09-01", "Toronto E01", "sf_detached", 374.7, 1_382_900, -7.39]],
  });

  it("does not fall back to an older month when the district is missing from the newest", () => {
    const rows = [
      ...market,
      { ...market[0], period: "2026-10-01", area: "Toronto E02" },
    ];
    // newest period is October and E01 has no October row, so E01 must be absent, not August
    expect(districtRow(rows, "E01", "detached")).toBeUndefined();
    expect(districtRow(rows, "E01", "detached", "2026-09-01")?.sales).toBe(13);
  });
  it("returns the latest period for a district and type", () => {
    expect(districtRow(market, "E01", "detached")?.sales).toBe(13);
    expect(districtRow(market, "E01", "semi_detached")?.sales).toBe(28);
    expect(districtRow(market, "E99", "detached")).toBeUndefined();
  });
  it("finds the HPI benchmark", () => {
    expect(districtHpi(hpi, "E01", "sf_detached")?.benchmark).toBe(1_382_900);
    expect(districtHpi(hpi, "E01", "townhouse")).toBeUndefined();
  });
});

describe("targetDistricts", () => {
  it("returns unique districts in sorted order", () => {
    const buyer = {
      target_areas: [
        { name: "A", districts: ["W07", "E01"] },
        { name: "B", districts: ["E01", "E02"] },
      ],
    } as unknown as Buyer;
    expect(targetDistricts(buyer)).toEqual(["E01", "E02", "W07"]);
  });
});
