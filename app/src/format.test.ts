import { describe, expect, it } from "vitest";
import { daysSince, esc, isPercent, fmtDate, fmtMoneyCompact, fmtSigned, fmtValue, staleLabel } from "./format";

describe("fmtValue", () => {
  it("formats by unit", () => {
    expect(fmtValue(2.25, "percent")).toBe("2.25%");
    expect(fmtValue(1.4222, "CAD per USD")).toBe("1.4222");
    expect(fmtValue(2046, "dollars per month")).toBe("$2,046");
    expect(fmtValue(171.74, "index (2002=100)")).toBe("171.7");
    expect(fmtValue(3788.7, "thousands of persons")).toBe("3,788.7K");
    expect(fmtValue(0.42, "percentage points")).toBe("0.42 pp");
    expect(fmtValue(2.5, "percent (year over year)")).toBe("2.50%");
  });
});

describe("isPercent", () => {
  it("does not confuse percentage points with percent", () => {
    expect(isPercent("percent")).toBe(true);
    expect(isPercent("percent (year over year)")).toBe(true);
    expect(isPercent("percentage points")).toBe(false);
  });
});

describe("fmtMoneyCompact", () => {
  it("compacts millions and thousands", () => {
    expect(fmtMoneyCompact(1_417_600)).toBe("$1.42M");
    expect(fmtMoneyCompact(950_000)).toBe("$950K");
    expect(fmtMoneyCompact(500)).toBe("$500");
  });
});

describe("fmtDate", () => {
  it("matches the series frequency", () => {
    expect(fmtDate("2026-08-01", "monthly")).toBe("Aug 2026");
    expect(fmtDate("2025-01-01", "annual")).toBe("2025");
    expect(fmtDate("2026-10-13", "daily")).toBe("Oct 13, 2026");
  });
});

describe("fmtSigned", () => {
  it("uses a true minus sign and explicit plus", () => {
    expect(fmtSigned(1.234, 1, "%")).toBe("+1.2%");
    expect(fmtSigned(-0.47, 2)).toBe("−0.47");
    expect(fmtSigned(0, 1)).toBe("0.0");
  });
});

describe("esc", () => {
  it("escapes markup in labels", () => {
    expect(esc('<img src=x onerror="a()">&')).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;");
  });
});

describe("staleLabel", () => {
  it("is human readable", () => {
    expect(staleLabel(0)).toBe("today");
    expect(staleLabel(1)).toBe("1 day ago");
    expect(staleLabel(43)).toBe("43 days ago");
    expect(staleLabel(74)).toBe("2 months ago");
  });
});

describe("daysSince", () => {
  it("counts whole days from an ISO date at view time", () => {
    const now = new Date(2026, 9, 14, 15, 30); // 14 Oct 2026, local
    expect(daysSince("2026-10-14", now)).toBe(0);
    expect(daysSince("2026-10-13", now)).toBe(1);
    expect(daysSince("2026-08-01", now)).toBe(74);
    expect(daysSince("2026-12-01", now)).toBe(0); // future dates never go negative
  });
});
