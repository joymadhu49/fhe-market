type Props = { size?: number; color?: string; holeColor?: string };

export default function LockGlyph({ size = 28, color = "var(--k)", holeColor = "var(--y)" }: Props) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <g fill={color}>
        {/* shackle */}
        <rect x="5" y="2" width="1" height="1" />
        <rect x="6" y="1" width="4" height="1" />
        <rect x="10" y="2" width="1" height="1" />
        <rect x="5" y="3" width="1" height="3" />
        <rect x="10" y="3" width="1" height="3" />
        {/* body */}
        <rect x="3" y="6" width="10" height="8" />
      </g>
      {/* keyhole cut */}
      <g fill={holeColor}>
        <rect x="7" y="9" width="2" height="2" />
        <rect x="7" y="11" width="2" height="2" />
      </g>
    </svg>
  );
}
