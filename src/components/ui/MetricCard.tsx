"use client";
import { ReactNode } from "react";

export default function MetricCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="p-4"
      style={{
        background: "var(--w)",
        border: "2px solid var(--k)",
        borderTop: accent ? "6px solid var(--y)" : "2px solid var(--k)",
      }}
    >
      <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
        {label}
      </div>
      <div className="mono mt-2 font-bold" style={{ fontSize: 26 }}>
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
