import { useEffect, useLayoutEffect, useState } from "react";

export type ThemeMode = "auto" | "light" | "dark";
export type Resolved = "light" | "dark";

/**
 * Colors come from the validated reference palette (dataviz skill, palette.md).
 * Series slots 1 and 2 were run through validate_palette.js for both modes (2026-10-14).
 * This table is the single source of truth: it is written to CSS custom properties at runtime
 * and read directly when building chart options.
 */
export const TOKENS = {
  light: {
    surface: "#fcfcfb",
    page: "#f9f9f7",
    ink: "#0b0b0b",
    ink2: "#52514e",
    muted: "#898781",
    grid: "#e1e0d9",
    baseline: "#c3c2b7",
    border: "rgba(11, 11, 11, 0.10)",
    series1: "#2a78d6",
    series2: "#eb6834",
    track: "#cde2fb",
    wash: "rgba(42, 120, 214, 0.08)",
  },
  dark: {
    surface: "#1a1a19",
    page: "#0d0d0d",
    ink: "#f0efec",
    ink2: "#c3c2b7",
    muted: "#898781",
    grid: "#2c2c2a",
    baseline: "#383835",
    border: "rgba(255, 255, 255, 0.10)",
    series1: "#3987e5",
    series2: "#d95926",
    track: "#184f95",
    wash: "rgba(57, 135, 229, 0.12)",
  },
} as const;

export type Tokens = (typeof TOKENS)[Resolved];

const KEY = "flashlight-theme";

function stored(): ThemeMode {
  const q = new URLSearchParams(window.location.search).get("theme");
  if (q === "light" || q === "dark") return q;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    // storage can be unavailable (private windows); fall back to auto
  }
  return "auto";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(stored);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolved: Resolved = mode === "auto" ? (systemDark ? "dark" : "light") : mode;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const t = TOKENS[resolved];
    for (const [k, v] of Object.entries(t)) root.style.setProperty(`--${k}`, v);
    root.style.colorScheme = resolved;
  }, [resolved]);

  const update = (m: ThemeMode) => {
    setMode(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      // ignore
    }
  };
  return { mode, resolved, setMode: update, tokens: TOKENS[resolved] as Tokens };
}
