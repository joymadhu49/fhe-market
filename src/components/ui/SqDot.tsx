"use client";

export type SqDotKind = "open" | "pending" | "loss" | "reveal" | "win" | "off";

const COLORS: Record<SqDotKind, string> = {
  open: "var(--green)",
  pending: "var(--amber)",
  loss: "var(--red)",
  reveal: "var(--blue)",
  win: "var(--green)",
  off: "var(--g2)",
};

export default function SqDot({
  kind = "open",
  size = 8,
  className,
}: {
  kind?: SqDotKind;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={"sqdot " + (className ?? "")}
      style={{ background: COLORS[kind], width: size, height: size }}
    />
  );
}
