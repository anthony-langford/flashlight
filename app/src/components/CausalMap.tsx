import { useMemo, useState } from "react";
import { sliceRange } from "../data";
import { useSeriesData } from "../hooks";
import {
  EVIDENCE_TEXT,
  COL_GAP,
  LEFT,
  NODE_H,
  NODE_W,
  canvasSize,
  edgeGeometry,
  evidenceDetail,
  nodePos,
  nodeReadout,
  propagate,
  weakestConfidence,
  type Impact,
} from "../graphModel";
import type { Tokens } from "../theme";
import type { AppData, GraphEdge, GraphNode } from "../types";
import { SeriesChart } from "./SeriesChart";

type Selection = { kind: "node"; id: string } | { kind: "edge"; index: number } | null;

const TREND_GLYPH = { up: "▲", down: "▼", flat: "▬" } as const;
const EFFECT_GLYPH = { up: "▲", down: "▼", mixed: "◆" } as const;
const EFFECT_WORD = { up: "tends to rise", down: "tends to fall", mixed: "mixed: paths disagree" } as const;
const WIDTH = { established: 2.5, plausible: 1.75, debated: 1.25 } as const;

function wrap(label: string, max = 19): string[] {
  const words = label.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length > 2 ? [lines[0], lines.slice(1).join(" ").slice(0, max - 1) + "…"] : lines;
}

function onKey(fn: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

/** `#/map?node=gov_5y_yield`, `#/map?edge=5`, `#/map?shock=boc_policy_rate&dir=up` preset the view. */
function initialState(data: AppData, params?: URLSearchParams) {
  const ids = new Set(data.graph.nodes.map((n) => n.id));
  const node = params?.get("node");
  const edge = Number(params?.get("edge"));
  const shock = params?.get("shock");
  const dir = params?.get("dir");
  return {
    selection: (node && ids.has(node)
      ? { kind: "node", id: node }
      : params?.get("edge") !== null && params?.get("edge") !== undefined && edge >= 0 && edge < data.graph.edges.length
        ? { kind: "edge", index: edge }
        : null) as Selection,
    shockNode: shock && ids.has(shock) ? shock : "boc_policy_rate",
    shockDir: (shock && ids.has(shock) ? (dir === "down" ? -1 : 1) : null) as 1 | -1 | null,
  };
}

export function CausalMap({
  data,
  tokens,
  params,
}: {
  data: AppData;
  tokens: Tokens;
  params?: URLSearchParams;
}) {
  const { graph } = data;
  const init = useMemo(() => initialState(data, params), [data, params]);
  const [selection, setSelection] = useState<Selection>(init.selection);
  const [onlyEstablished, setOnlyEstablished] = useState(false);
  const [shockNode, setShockNode] = useState<string>(init.shockNode);
  const [shockDir, setShockDir] = useState<1 | -1 | null>(init.shockDir);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const { w, h } = useMemo(() => canvasSize(graph), [graph]);
  const lastCol = graph.columns.length - 1;
  const visibleEdges = graph.edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !onlyEstablished || e.confidence === "established");

  const impacts: Impact[] = useMemo(
    () => (shockDir ? propagate(graph, shockNode, shockDir) : []),
    [graph, shockNode, shockDir],
  );
  const impactByNode = new Map(impacts.map((i) => [i.node, i]));
  const shockEdges = new Set(impacts.flatMap((i) => i.paths.flatMap((p) => p.edges)));

  const connected = (() => {
    if (!selection) return null;
    if (selection.kind === "node") {
      const ids = new Set<string>([selection.id]);
      const edges = new Set<number>();
      graph.edges.forEach((e, i) => {
        if (e.from === selection.id || e.to === selection.id) {
          ids.add(e.from);
          ids.add(e.to);
          edges.add(i);
        }
      });
      return { ids, edges };
    }
    const e = graph.edges[selection.index];
    return { ids: new Set([e.from, e.to]), edges: new Set([selection.index]) };
  })();

  return (
    <section className="panel" aria-labelledby="map-h">
      <h2 id="map-h">Causal map</h2>
      <p className="muted">
        How the indicators are claimed to influence each other, left to right. Every connection is a{" "}
        <strong>claim</strong> with a rationale and a confidence tag. All of them are currently{" "}
        <strong>drafts</strong> written from general economic reasoning and not yet reviewed. Click a
        node or a connection for detail.
      </p>

      <div className="filters" role="group" aria-label="Map controls">
        <label className="check">
          <input
            type="checkbox"
            checked={onlyEstablished}
            onChange={(e) => setOnlyEstablished(e.target.checked)}
          />
          Established connections only
        </label>
        <div className="shock-controls">
          <label className="small muted" htmlFor="shock-node">Trace a shock from</label>
          <select id="shock-node" value={shockNode} onChange={(e) => setShockNode(e.target.value)}>
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="Direction">
            <button type="button" aria-pressed={shockDir === 1} className={shockDir === 1 ? "seg active" : "seg"} onClick={() => setShockDir(1)}>Rises</button>
            <button type="button" aria-pressed={shockDir === -1} className={shockDir === -1 ? "seg active" : "seg"} onClick={() => setShockDir(-1)}>Falls</button>
          </div>
          {shockDir && (
            <button type="button" className="chip" onClick={() => setShockDir(null)}>Clear</button>
          )}
        </div>
      </div>

      <ul className="legend small muted" aria-label="Legend">
        <li><span className="swatch pos" aria-hidden="true" /> Same direction (+)</li>
        <li><span className="swatch neg" aria-hidden="true" /> Opposite direction (&minus;)</li>
        <li><span className="swatch thick" aria-hidden="true" /> Thicker line: more established</li>
        <li><span className="swatch dashed" aria-hidden="true" /> Dashed: draft, not yet reviewed</li>
        <li>&#9650; &#9660; &#9644; Direction over the past year</li>
      </ul>

      <div className="chart-card map-card">
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="group" aria-label="Causal map of Toronto housing drivers">
          <defs>
            {(["pos", "neg"] as const).map((k) => (
              <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: k === "pos" ? "var(--series1)" : "var(--series2)" }} />
              </marker>
            ))}
          </defs>

          {graph.columns.map((c, i) => (
            <text key={c} x={LEFT + i * (NODE_W + COL_GAP) + NODE_W / 2} y={20} textAnchor="middle" className="map-col">{c}</text>
          ))}

          {visibleEdges.map(({ e, i }) => {
            const a = nodeById.get(e.from)!;
            const b = nodeById.get(e.to)!;
            const { d, mid } = edgeGeometry(a, b, lastCol);
            const pos = e.sign === "+";
            const inShock = shockDir !== null && shockEdges.has(e);
            const dim = (connected && !connected.edges.has(i)) || (shockDir !== null && !inShock);
            const selected = selection?.kind === "edge" && selection.index === i;
            const label = `${a.label} to ${b.label}, ${pos ? "same direction" : "opposite direction"}, ${e.confidence}, ${e.review}`;
            return (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                className="map-edge"
                opacity={dim ? 0.3 : 1}
                onClick={() => setSelection({ kind: "edge", index: i })}
                onKeyDown={onKey(() => setSelection({ kind: "edge", index: i }))}
              >
                <title>{`${label}. ${EVIDENCE_TEXT[e.evidence.status]}.`}</title>
                <path d={d} className="hit" />
                <path
                  d={d}
                  fill="none"
                  strokeWidth={selected || inShock ? WIDTH[e.confidence] + 1.5 : WIDTH[e.confidence]}
                  strokeDasharray={e.review === "draft" ? "7 5" : undefined}
                  strokeLinecap="round"
                  markerEnd={`url(#arrow-${pos ? "pos" : "neg"})`}
                  style={{ stroke: pos ? "var(--series1)" : "var(--series2)" }}
                />
                <circle cx={mid.x} cy={mid.y} r={9} className="badge" style={{ stroke: pos ? "var(--series1)" : "var(--series2)" }} />
                <text x={mid.x} y={mid.y + 4} textAnchor="middle" className="badge-text">{pos ? "+" : "−"}</text>
              </g>
            );
          })}

          {graph.nodes.map((n) => {
            const { x, y } = nodePos(n);
            const r = nodeReadout(n, data);
            const selected = selection?.kind === "node" && selection.id === n.id;
            const impact = impactByNode.get(n.id);
            const isShockStart = shockDir !== null && n.id === shockNode;
            const dim =
              (connected && !connected.ids.has(n.id)) || (shockDir !== null && !impact && !isShockStart);
            const lines = wrap(n.label);
            const label = `${n.label}${r ? `: ${r.value}, ${r.sub}` : ", concept with no data series"}${impact ? `. If ${graph.nodes.find((g) => g.id === shockNode)?.label} ${shockDir === 1 ? "rises" : "falls"}, ${EFFECT_WORD[impact.effect]}` : ""}`;
            return (
              <g
                key={n.id}
                transform={`translate(${x},${y})`}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                className="map-node"
                opacity={dim ? 0.4 : 1}
                onClick={() => setSelection({ kind: "node", id: n.id })}
                onKeyDown={onKey(() => setSelection({ kind: "node", id: n.id }))}
              >
                <title>{label}</title>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  className={selected ? "node-box selected" : "node-box"}
                  style={isShockStart ? { strokeWidth: 2.5, stroke: "var(--ink)" } : undefined}
                />
                {lines.map((ln, i) => (
                  <text key={i} x={10} y={18 + i * 14} className="node-label">{ln}</text>
                ))}
                {r ? (
                  <>
                    <text x={10} y={NODE_H - 10} className="node-value">
                      {r.value}
                      {r.trend ? ` ${TREND_GLYPH[r.trend]}` : ""}
                    </text>
                    {r.percentile !== null && (
                      <text x={NODE_W - 8} y={NODE_H - 10} textAnchor="end" className="node-sub">P{Math.round(r.percentile)}</text>
                    )}
                  </>
                ) : (
                  <text x={10} y={NODE_H - 10} className="node-sub">concept, no data</text>
                )}
                {impact && (
                  <g transform={`translate(${NODE_W - 4},-6)`}>
                    <circle r={11} className="effect-badge" />
                    <text y={4} textAnchor="middle" className="effect-glyph">{EFFECT_GLYPH[impact.effect]}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="muted small">
        P is where the latest reading sits in its own history (P90 means 90% of past readings were at or
        below it). Toronto market nodes have only one month of data so far.
      </p>

      {shockDir && (
        <ShockPanel
          graph={graph.nodes}
          start={nodeById.get(shockNode)!}
          dir={shockDir}
          impacts={impacts}
          onSelectNode={(id) => setSelection({ kind: "node", id })}
        />
      )}

      {selection?.kind === "node" && (
        <NodePanel
          node={nodeById.get(selection.id)!}
          data={data}
          tokens={tokens}
          onSelectEdge={(i) => setSelection({ kind: "edge", index: i })}
        />
      )}
      {selection?.kind === "edge" && (
        <EdgePanel
          edge={graph.edges[selection.index]}
          from={nodeById.get(graph.edges[selection.index].from)!}
          to={nodeById.get(graph.edges[selection.index].to)!}
          onSelectNode={(id) => setSelection({ kind: "node", id })}
        />
      )}

      <details className="table-view">
        <summary>View all connections as a table</summary>
        <div className="table-scroll">
          <table>
            <caption>Every claimed connection, with its data check</caption>
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Direction</th>
                <th scope="col">Typical lag</th>
                <th scope="col">Confidence</th>
                <th scope="col">Status</th>
                <th scope="col">Data check</th>
              </tr>
            </thead>
            <tbody>
              {graph.edges.map((e, i) => (
                <tr key={i}>
                  <th scope="row">{nodeById.get(e.from)?.label}</th>
                  <td>{nodeById.get(e.to)?.label}</td>
                  <td>{e.sign === "+" ? "Same" : "Opposite"}</td>
                  <td>{e.lag}</td>
                  <td>{e.confidence}</td>
                  <td>{e.review}</td>
                  <td>{EVIDENCE_TEXT[e.evidence.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function ShockPanel({
  graph,
  start,
  dir,
  impacts,
  onSelectNode,
}: {
  graph: GraphNode[];
  start: GraphNode;
  dir: 1 | -1;
  impacts: Impact[];
  onSelectNode: (id: string) => void;
}) {
  const label = (id: string) => graph.find((n) => n.id === id)?.label ?? id;
  return (
    <div className="notice shock" aria-live="polite">
      <strong>
        If &ldquo;{start.label}&rdquo; {dir === 1 ? "rises" : "falls"}
      </strong>
      <p className="small muted">
        Illustrative only, not a forecast. This follows the claimed connections, all still drafts, and
        ignores size, timing overlap and everything outside the map. The markers on the map show the
        direction of each effect.
      </p>
      {impacts.length === 0 ? (
        <p>No connections lead out of this node.</p>
      ) : (
        <ol className="shock-list">
          {impacts.map((i) => {
            const p = i.paths[0];
            return (
              <li key={i.node}>
                <button type="button" className="linklike" onClick={() => onSelectNode(i.node)}>
                  {label(i.node)}
                </button>{" "}
                <span aria-hidden="true">{EFFECT_GLYPH[i.effect]}</span> {EFFECT_WORD[i.effect]}
                <div className="small muted">
                  {i.hops} step{i.hops === 1 ? "" : "s"} via {p.nodes.slice(1, -1).map(label).join(", ") || "a direct link"}. Weakest link
                  on the shortest path: {weakestConfidence(p)}. Typical timing: {p.edges.map((e) => e.lag).join(", then ")}.
                  {i.paths.length > 1 ? ` ${i.paths.length} paths in total.` : ""}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function NodePanel({
  node,
  data,
  tokens,
  onSelectEdge,
}: {
  node: GraphNode;
  data: AppData;
  tokens: Tokens;
  onSelectEdge: (i: number) => void;
}) {
  const s = node.series ? data.catalogue.find((c) => c.id === node.series) : undefined;
  const { data: series, error } = useSeriesData(node.series);
  const index = !!s && s.unit.toLowerCase().startsWith("index");
  const points = useMemo(() => {
    if (!series || !s || series.id !== s.id) return [];
    return sliceRange(index && series.yoy ? series.yoy : series.obs, "10Y");
  }, [series, s, index]);
  const r = nodeReadout(node, data);
  const nodeLabel = (id: string) => data.graph.nodes.find((n) => n.id === id)?.label ?? id;
  const inbound = data.graph.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.to === node.id);
  const outbound = data.graph.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.from === node.id);
  return (
    <div className="detail-panel">
      <h3>{node.label}</h3>
      {r ? (
        <p>
          <strong>{r.value}</strong> <span className="muted small">{r.sub}</span>
        </p>
      ) : (
        <p className="muted">A concept, not a measured series. It links the numbers around it.</p>
      )}
      {s && points.length > 0 && (
        <div className="chart-card">
          <SeriesChart
            points={points}
            unit={index ? "percent" : s.unit}
            frequency={s.frequency}
            name={index ? `${s.title}, year over year` : s.title}
            tokens={tokens}
          />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {s?.explainer && (
        <>
          <p>{s.explainer.what}</p>
          <p className="muted">{s.explainer.why_it_matters}</p>
        </>
      )}
      <div className="edge-lists">
        <div>
          <h4>Influenced by</h4>
          {inbound.length === 0 ? <p className="muted small">Nothing in this map.</p> : (
            <ul>
              {inbound.map(({ e, i }) => (
                <li key={i}><button type="button" className="linklike" onClick={() => onSelectEdge(i)}>{nodeLabel(e.from)} ({e.sign === "+" ? "same" : "opposite"})</button></li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>Influences</h4>
          {outbound.length === 0 ? <p className="muted small">Nothing in this map.</p> : (
            <ul>
              {outbound.map(({ e, i }) => (
                <li key={i}><button type="button" className="linklike" onClick={() => onSelectEdge(i)}>{nodeLabel(e.to)} ({e.sign === "+" ? "same" : "opposite"})</button></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EdgePanel({
  edge,
  from,
  to,
  onSelectNode,
}: {
  edge: GraphEdge;
  from: GraphNode;
  to: GraphNode;
  onSelectNode: (id: string) => void;
}) {
  const same = edge.sign === "+";
  return (
    <div className="detail-panel">
      <h3>
        <button type="button" className="linklike" onClick={() => onSelectNode(from.id)}>{from.label}</button>
        {" → "}
        <button type="button" className="linklike" onClick={() => onSelectNode(to.id)}>{to.label}</button>
      </h3>
      <p>
        When &ldquo;{from.label}&rdquo; rises, &ldquo;{to.label}&rdquo; {same ? "tends to rise" : "tends to fall"}.
      </p>
      <p className="muted">{edge.rationale}</p>
      <ul className="facts-list small">
        <li><strong>Typical timing:</strong> {edge.lag}</li>
        <li><strong>Confidence:</strong> {edge.confidence}</li>
        <li><strong>Review status:</strong> {edge.review === "draft" ? "draft, not yet reviewed by you" : "reviewed"}</li>
        <li><strong>Data check:</strong> {EVIDENCE_TEXT[edge.evidence.status]}. {evidenceDetail(edge)}</li>
      </ul>
      <p className="muted small">
        The data check looks at monthly changes and asks only whether the history is consistent with the
        claim. It is not proof that one thing causes the other.
      </p>
    </div>
  );
}
