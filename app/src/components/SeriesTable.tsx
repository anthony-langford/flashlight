import { fmtDate, fmtValue } from "../format";
import type { SeriesSummary } from "../types";

const MAX_ROWS = 120;

/** Table twin of the chart: the same values, newest first. */
export function SeriesTable({
  points,
  unit,
  frequency,
  valueLabel,
}: {
  points: [string, number][];
  unit: string;
  frequency: SeriesSummary["frequency"];
  valueLabel: string;
}) {
  const rows = [...points].reverse().slice(0, MAX_ROWS);
  return (
    <details className="table-view">
      <summary>View as table</summary>
      <div className="table-scroll">
        <table>
          <caption>
            {valueLabel}, newest first
            {points.length > MAX_ROWS ? ` (latest ${MAX_ROWS} of ${points.length} readings)` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col" className="num">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([d, v]) => (
              <tr key={d}>
                <td>{fmtDate(d, frequency)}</td>
                <td className="num">{fmtValue(v, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
