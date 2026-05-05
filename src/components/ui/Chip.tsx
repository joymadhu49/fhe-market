"use client";
import { ReactNode } from "react";

type Color = "k" | "w" | "y" | "g" | "r" | "b";

const COLORS: Record<Color, { bg: string; fg: string; bd?: string }> = {
  k: { bg: "var(--k)", fg: "var(--w)" },
  w: { bg: "var(--w)", fg: "var(--k)", bd: "var(--k)" },
  y: { bg: "var(--y)", fg: "var(--k)" },
  g: { bg: "var(--green)", fg: "var(--k)" },
  r: { bg: "var(--red)", fg: "var(--w)" },
  b: { bg: "var(--blue)", fg: "var(--w)" },
};

export default function Chip({
  children,
  color = "k",
  className,
}: {
  children: ReactNode;
  color?: Color;
  className?: string;
}) {
  const c = COLORS[color];
  return (
    <span
      className={"mono inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] " + (className ?? "")}
      style={{
        background: c.bg,
        color: c.fg,
        border: c.bd ? `1px solid ${c.bd}` : "none",
      }}
    >
      {children}
    </span>
  );
}
