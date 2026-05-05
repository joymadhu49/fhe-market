import PixelDebris from "@/components/ui/PixelDebris";
import SqDot from "@/components/ui/SqDot";

export default function LeaderboardPage() {
  return (
    <div style={{ background: "var(--g0)" }}>
      {/* Yellow hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--y)", borderBottom: "2px solid var(--k)" }}
      >
        <PixelDebris count={16} seed={9} />
        <div className="relative z-[3] mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
          <div className="eyebrow" style={{ color: "var(--k)" }}>
            LEADERBOARD
          </div>
          <h1
            className="display m-0 mt-2"
            style={{
              fontSize: "clamp(28px, 5vw, 52px)",
              lineHeight: 1,
              color: "var(--k)",
              letterSpacing: "-0.03em",
            }}
          >
            Top traders. By P&L. By volume.
          </h1>
          <div
            className="mono mt-2 text-[10px] tracking-[0.12em] font-bold"
            style={{ color: "var(--k)" }}
          >
            REALIZED P&L · VOLUME · WIN RATE
          </div>
        </div>
      </section>

      {/* Coming soon stage */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-16">
        <div
          className="relative overflow-hidden"
          style={{
            background: "var(--w)",
            border: "2px solid var(--k)",
          }}
        >
          <PixelDebris count={12} seed={3} />
          <div className="relative z-[3] py-24 sm:py-32 px-6 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 mb-6">
              <SqDot kind="open" size={8} />
              <span
                className="mono text-[11px] tracking-[0.18em] font-bold"
                style={{ color: "var(--k)" }}
              >
                COMING SOON
              </span>
              <SqDot kind="open" size={8} />
            </div>

            <h2
              className="display m-0"
              style={{
                fontSize: "clamp(56px, 11vw, 160px)",
                lineHeight: 0.85,
                color: "var(--k)",
                letterSpacing: "-0.05em",
                fontWeight: 700,
              }}
            >
              BETTER
            </h2>
            <h2
              className="display m-0 mt-2"
              style={{
                fontSize: "clamp(56px, 11vw, 160px)",
                lineHeight: 0.85,
                letterSpacing: "-0.05em",
                fontWeight: 700,
                background: "var(--y)",
                color: "var(--k)",
                padding: "0.05em 0.25em",
                border: "2px solid var(--k)",
              }}
            >
              COMING SOON
            </h2>

            <p
              className="mono mt-8 max-w-[520px] text-[12px] tracking-[0.06em]"
              style={{ color: "var(--g2)" }}
            >
              INDEXING ON-CHAIN BET + CLAIM EVENTS OFF-CHAIN.
              RANKINGS LIGHT UP NEXT CYCLE.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
