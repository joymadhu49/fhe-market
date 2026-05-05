"use client";
import PixelDebris from "./PixelDebris";

/**
 * Isometric 3D stacked-block "encrypted vault" hero illustration.
 * White base / yellow middle (FHE label) / black top + small padlock face.
 * Pixel debris around the frame.
 */
export default function VaultBlock({ size = 240 }: { size?: number }) {
  const s = size;
  const cube = (top: number, left: number, color: string, z: number, label?: string) => (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: s * 0.42,
        height: s * 0.42,
        background: color,
        border: "2px solid var(--k)",
        transform: "rotateX(55deg) rotateZ(-45deg)",
        transformOrigin: "center",
        boxShadow: "8px 8px 0 0 var(--k)",
        display: "grid",
        placeItems: "center",
        zIndex: z,
      }}
    >
      {label && (
        <span
          className="mono"
          style={{
            color: "var(--k)",
            fontWeight: 700,
            fontSize: 14,
            transform: "rotateZ(45deg) rotateX(-55deg)",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ position: "relative", width: s, height: s, perspective: 800 }}>
      <div
        style={{
          position: "absolute",
          inset: -10,
          background: "var(--y-deep)",
          opacity: 0.5,
          zIndex: 0,
          clipPath: "polygon(20% 5%, 95% 12%, 88% 92%, 8% 88%)",
        }}
      />
      {cube(s * 0.30, s * 0.20, "var(--w)", 1)}
      {cube(s * 0.18, s * 0.32, "var(--y)", 2, "FHE")}
      {cube(s * 0.06, s * 0.20, "var(--k)", 3)}
      {/* Padlock face on top cube */}
      <div
        style={{
          position: "absolute",
          top: s * 0.10,
          left: s * 0.36,
          width: 28,
          height: 24,
          border: "2px solid var(--y)",
          zIndex: 4,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 4,
            width: 16,
            height: 12,
            border: "2px solid var(--y)",
            borderBottom: "none",
          }}
        />
      </div>
      <PixelDebris count={18} seed={3} />
    </div>
  );
}
