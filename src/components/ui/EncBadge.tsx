import LockGlyph from "./LockGlyph";

type Variant = "inline" | "chip" | "tile";

type Props = {
  label?: string;
  variant?: Variant;
  className?: string;
};

/**
 * Brutalist "encrypted" indicator. Replaces the legacy 🔒 emoji + "enc" text.
 *
 * - inline: row-cell badge — yellow square + mono ENC, no border
 * - chip:   pill-like — yellow square inside jet border + mono ENC
 * - tile:   feature card — large square + display ENC (used on portfolio summary cards
 *           via LockGlyph directly, kept for completeness)
 */
export default function EncBadge({ label = "ENC", variant = "inline", className = "" }: Props) {
  if (variant === "chip") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 align-middle ${className}`}
        style={{ border: "2px solid var(--k)", padding: "2px 6px 2px 2px", background: "var(--w)" }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{ width: 18, height: 18, background: "var(--y)" }}
        >
          <LockGlyph size={12} />
        </span>
        <span
          className="mono"
          style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--k)" }}
        >
          {label}
        </span>
      </span>
    );
  }

  // inline (default): minimal — yellow square + mono label
  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      <span
        className="inline-flex items-center justify-center"
        style={{ width: 16, height: 16, background: "var(--y)", border: "1.5px solid var(--k)" }}
      >
        <LockGlyph size={10} />
      </span>
      <span
        className="mono"
        style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--k)" }}
      >
        {label}
      </span>
    </span>
  );
}
