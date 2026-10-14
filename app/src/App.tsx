import { useEffect, useState } from "react";
import { Overview } from "./components/Overview";
import { SeriesExplorer } from "./components/SeriesExplorer";
import { loadAll } from "./data";
import { useTheme, type ThemeMode } from "./theme";
import type { AppData } from "./types";

type Tab = "overview" | "indicators";

/** `#/indicators/boc.gov_5y_yield` selects a tab and an indicator. */
function parseHash(): { tab: Tab; id?: string } {
  const [, tab, id] = window.location.hash.split("/");
  return { tab: tab === "indicators" ? "indicators" : "overview", id: id ? decodeURIComponent(id) : undefined };
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
          {(["overview", "indicators"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? "tab active" : "tab"}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                window.location.hash = `#/${t}`;
              }}
            >
              {t === "overview" ? "Overview" : "Indicators"}
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
