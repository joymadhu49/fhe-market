"use client";
import { ReactNode } from "react";

export default function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex items-end justify-between pb-3 mb-5"
      style={{ borderBottom: "2px solid var(--k)" }}
    >
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <div className="display mt-1" style={{ fontSize: 28, color: "var(--k)" }}>
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}
