type Props = {
  label: string;
  value: string;
  delta?: { text: string; direction: "up" | "down" | "flat" } | null;
  asOf: string;
};

const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;

export function StatTile({ label, value, delta, asOf }: Props) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {delta ? (
        <div className="tile-delta">
          <span aria-hidden="true">{ARROW[delta.direction]}</span> {delta.text}
        </div>
      ) : (
        <div className="tile-delta">&nbsp;</div>
      )}
      <div className="tile-asof">{asOf}</div>
    </div>
  );
}
