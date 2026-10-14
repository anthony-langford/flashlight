import type { SeriesSummary } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** True for "percent" and "percent (...)" but not "percentage points". */
export function isPercent(unit: string): boolean {
  const u = unit.toLowerCase();
  return u === "percent" || u.startsWith("percent ");
}

/** Format a value by its catalogue unit. */
export function fmtValue(v: number, unit: string): string {
  const u = unit.toLowerCase();
  if (u === "percentage points") return `${v.toFixed(2)} pp`;
  if (isPercent(u)) return `${v.toFixed(Math.abs(v) >= 100 ? 1 : 2)}%`;
  if (u === "dollars per barrel") return `$${v.toFixed(2)}`;
  if (u === "dollars per month") return `$${Math.round(v).toLocaleString("en-CA")}`;
  if (u === "thousands of dollars") return `$${Math.round(v).toLocaleString("en-CA")}K`;
  if (u === "cad per usd") return v.toFixed(4);
  if (u === "thousands of persons") return `${v.toLocaleString("en-CA", { maximumFractionDigits: 1 })}K`;
  if (u.startsWith("index")) return v.toLocaleString("en-CA", { maximumFractionDigits: 1 });
  return v.toLocaleString("en-CA", { maximumFractionDigits: 2 });
}

/** Compact money for tiles and chart labels: $1.42M, $950K. */
export function fmtMoneyCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

export function fmtMoney(v: number): string {
  return `$${Math.round(v).toLocaleString("en-CA")}`;
}

/** Date label that matches the series frequency: "Aug 2026", "2025", "Oct 13, 2026". */
export function fmtDate(iso: string, frequency?: SeriesSummary["frequency"]): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (frequency === "annual") return String(y);
  if (frequency === "monthly" || frequency === "quarterly") return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function fmtSigned(v: number, digits = 1, suffix = ""): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(digits)}${suffix}`;
}

/** Escape text before inserting it into tooltip HTML. Labels are untrusted data. */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function staleLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}
