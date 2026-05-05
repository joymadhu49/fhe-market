/**
 * Brutalist OddsBar — single horizontal rect split YES/NO with hard
 * colored fills + cents on each end. `yes` is a percentage 0..100.
 */
interface Props {
  yes: number;
  height?: number;
  /** When false, hides the YES/NO uppercase labels (keeps cents). */
  showLabels?: boolean;
}

export default function OddsBar({ yes, height = 32, showLabels = true }: Props) {
  const y = Math.max(0, Math.min(100, Math.round(yes)));
  const n = 100 - y;
  return (
    <div className="flex" style={{ height, border: "2px solid var(--k)", background: "var(--w)" }}>
      <div
        className="flex items-center justify-between px-2.5"
        style={{
          width: `${y}%`,
          background: "var(--green)",
          color: "var(--k)",
          borderRight: "2px solid var(--k)",
        }}
      >
        {showLabels && (
          <span className="mono text-[10px] font-bold tracking-[0.1em]">YES</span>
        )}
        <span className="mono text-[12px] font-bold">{y}¢</span>
      </div>
      <div
        className="flex items-center justify-between px-2.5"
        style={{ width: `${n}%`, background: "var(--red)", color: "var(--w)" }}
      >
        <span className="mono text-[12px] font-bold">{n}¢</span>
        {showLabels && (
          <span className="mono text-[10px] font-bold tracking-[0.1em]">NO</span>
        )}
      </div>
    </div>
  );
}
