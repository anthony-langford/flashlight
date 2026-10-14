import { useEffect, useState } from "react";
import { loadSeries } from "./data";
import type { SeriesData } from "./types";

/** Load one series' observations. Keeps the previous data while the next one loads. */
export function useSeriesData(id: string | null): { data: SeriesData | null; error: string | null } {
  const [data, setData] = useState<SeriesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setError(null);
    loadSeries(id)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);
  return { data, error };
}
