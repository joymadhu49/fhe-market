"use client";
import { useMemo } from "react";

/**
 * Deterministic asymmetric pixel squares scattered around a frame.
 * Mirrors the Zama brutalist motif. Always absolutely positioned inside a
 * relative parent, pointer-events: none.
 */
export default function PixelDebris({
  count = 14,
  sizes = [3, 4, 6, 8, 10],
  white = false,
  seed = 1,
}: {
  count?: number;
  sizes?: number[];
  white?: boolean;
  seed?: number;
}) {
  const dots = useMemo(() => {
    const rand = (i: number) => {
      const x = Math.sin((i + seed) * 9973.13) * 10000;
      return x - Math.floor(x);
    };
    const out: { sz: number; top: string; left: string; delay: number }[] = [];
    for (let i = 0; i < count; i++) {
      const sz = sizes[Math.floor(rand(i) * sizes.length)] ?? 4;
      const edge = Math.floor(rand(i + 100) * 4);
      const r1 = rand(i + 200);
      const r2 = rand(i + 300);
      const margin = 22;
      let top = "";
      let left = "";
      if (edge === 0) {
        top = `${r1 * margin}%`;
        left = `${r2 * 100}%`;
      } else if (edge === 1) {
        top = `${100 - r1 * margin}%`;
        left = `${r2 * 100}%`;
      } else if (edge === 2) {
        left = `${r1 * margin}%`;
        top = `${r2 * 100}%`;
      } else {
        left = `${100 - r1 * margin}%`;
        top = `${r2 * 100}%`;
      }
      out.push({ sz, top, left, delay: i * 18 });
    }
    return out;
  }, [count, sizes, seed]);

  return (
    <div
      aria-hidden
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
    >
      {dots.map((d, i) => (
        <span
          key={i}
          className={"pxd" + (white ? " w" : "")}
          style={{
            width: d.sz,
            height: d.sz,
            top: d.top,
            left: d.left,
            animationDelay: `${d.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}
