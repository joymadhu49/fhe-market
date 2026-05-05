"use client";
import { ReactNode } from "react";
import SqDot, { SqDotKind } from "./SqDot";

export default function StatCard({
  label,
  value,
  sub,
  dot,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  dot?: SqDotKind;
}) {
  return (
    <div
      className="px-4 py-3"
      style={{ background: "var(--w)", border: "2px solid var(--k)" }}
    >
      <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
        {label}
      </div>
      <div
        className="display flex items-center gap-2 mt-1.5"
        style={{ fontSize: 26, color: "var(--k)" }}
      >
        {dot && <SqDot kind={dot} size={10} />}
        {value}
      </div>
      {sub && (
        <div className="mono text-[10px] tracking-[0.1em] mt-1" style={{ color: "var(--g2)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
