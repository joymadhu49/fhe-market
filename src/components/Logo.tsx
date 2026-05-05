"use client";

/**
 * 3×3 yellow pixel-grid glyph + monospace wordmark. Inverse mode flips the
 * negative-space squares to black for white-bg surfaces.
 */
export default function Logo({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  // 3×3 mask: 1 = filled, 0 = transparent. Reads roughly as an "F" outline.
  const mask = [1, 1, 0, 1, 1, 1, 0, 1, 1];
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(3, 6px)", gridAutoRows: 6, gap: 1 }}
        aria-hidden
      >
        {mask.map((v, i) => (
          <span
            key={i}
            style={{
              background: v ? "var(--y)" : inverse ? "var(--k)" : "transparent",
              width: 6,
              height: 6,
            }}
          />
        ))}
      </div>
      {!compact && (
        <span
          className="mono"
          style={{
            color: inverse ? "var(--k)" : "var(--w)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.18em",
            whiteSpace: "nowrap",
          }}
        >
          FHE&nbsp;MARKET
        </span>
      )}
    </div>
  );
}
