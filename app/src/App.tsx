import { useEffect, useState } from "react";
import { CausalMap } from "./components/CausalMap";
import { AffordabilityPanel } from "./components/AffordabilityPanel";
import { Overview } from "./components/Overview";
import { SeriesExplorer } from "./components/SeriesExplorer";
import { loadAll } from "./data";
import { useTheme, type ThemeMode } from "./theme";
import type { AppData } from "./types";

type Tab = "overview" | "indicators" | "map" | "affordability";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  indicators: "Indicators",
  map: "Causal map",
  affordability: "Affordability",
};

/**
 * `#/indicators/boc.gov_5y_yield` selects a tab and an indicator.
 * `#/affordability?price=1200000&down=95000&rate=5&amort=30&ftb=1` presets a scenario.
 */
function parseHash(): { tab: Tab; id?: string; params: URLSearchParams } {
  const [path, query = ""] = window.location.hash.replace(/^#/, "").split("?");
  const [, tab, id] = path.split("/");
  const known: Tab[] = ["overview", "indicators", "map", "affordability"];
  return {
    tab: known.includes(tab as Tab) ? (tab as Tab) : "overview",
    id: id ? decodeURIComponent(id) : undefined,
    params: new URLSearchParams(query),
  };
}

export default function App() {
  const { mode, setMode, tokens } = useTheme();
  const [route, setRoute] = useState(parseHash);
  const tab = route.tab;
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    loadAll()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Flashlight</h1>
          <span className="muted">Toronto housing, explained</span>
        </div>
        <nav aria-label="Sections" className="tabs">
          {(["overview", "indicators", "map", "affordability"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? "tab active" : "tab"}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                window.location.hash = `#/${t}`;
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
        <label className="theme">
          <span className="muted small">Theme</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)}>
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </header>

      <main>
        {error && <p className="error">{error}</p>}
        {!data && !error && <p className="muted">Loading&hellip;</p>}
        {data && tab === "overview" && <Overview data={data} tokens={tokens} />}
        {data && tab === "map" && <CausalMap data={data} tokens={tokens} params={route.params} />}
        {data && tab === "affordability" && <AffordabilityPanel data={data} params={route.params} />}
        {data && tab === "indicators" && (
          <SeriesExplorer
            key={route.id ?? "default"}
            catalogue={data.catalogue}
            tokens={tokens}
            initialId={route.id}
            onSelect={(id) => {
              window.history.replaceState(null, "", `#/indicators/${encodeURIComponent(id)}`);
            }}
          />
        )}
      </main>

      <footer className="muted small">
        {data && <p>Data exported {data.meta.generated_at.replace("T", " ").replace("+00:00", " UTC")}.</p>}
        <p>
          Sources: Bank of Canada, Statistics Canada, FRED, CMHC, TRREB. TRREB content is copyrighted
          and used here for personal reference only. Educational project, not financial advice.
        </p>
      </footer>
    </div>
  );
}
