import Link from "next/link";
import Logo from "@/components/Logo";

const TWITTER_URL = "https://x.com/zx_joy_";

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    "mono text-[12px] tracking-[0.06em] text-white hover:text-[var(--y)] transition-colors";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function Footer() {
  const cols: [string, [string, string, boolean?][]][] = [
    [
      "PRODUCT",
      [
        ["Markets", "/", false],
        ["Portfolio", "/portfolio", false],
        ["Leaderboard", "/leaderboard", false],
        ["Faucet", "/docs#faucet", false],
      ],
    ],
    [
      "DEVELOPERS",
      [
        ["Docs", "/docs", false],
        ["Contracts", "/docs#contracts", false],
        ["Sepolia status", "https://sepolia.etherscan.io", true],
        ["GitHub", "https://github.com/joymadhu49/fhe-market", true],
      ],
    ],
    [
      "COMMUNITY",
      [
        ["X / Twitter", TWITTER_URL, true],
        ["Zama FHEVM", "https://docs.zama.org/protocol", true],
        ["Manifesto", "/docs#privacy-model", false],
      ],
    ],
  ];

  return (
    <footer style={{ background: "var(--k)", color: "var(--w)" }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-14 pb-7">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p
              className="mt-4 text-[13px] leading-[1.6] max-w-[320px]"
              style={{ color: "var(--g1)" }}
            >
              Confidential by construction. A prediction market that doesn&apos;t leak your trade.
            </p>
          </div>

          {cols.map(([h, ls]) => (
            <div key={h}>
              <div className="eyebrow mb-4" style={{ color: "var(--y)" }}>
                {h}
              </div>
              <div className="grid gap-2">
                {ls.map(([label, href, ext]) => (
                  <FooterLink key={label} href={href} external={ext}>
                    {label}
                  </FooterLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-12 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ borderTop: "1px solid #222" }}
        >
          <div className="flex items-center gap-4">
            <a
              href={TWITTER_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="X (Twitter)"
              className="transition-colors"
              style={{ color: "var(--g1)" }}
            >
              <XIcon />
            </a>
            <a
              href="mailto:support@fhe-market.xyz"
              aria-label="Email"
              className="transition-colors"
              style={{ color: "var(--g1)" }}
            >
              <MailIcon />
            </a>
          </div>
          <div
            className="mono flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] tracking-[0.12em]"
            style={{ color: "var(--g1)" }}
          >
            <span>© {new Date().getFullYear()} FHE MARKET · BUILT ON ZAMA fhEVM</span>
            <Link href="/docs#terms" className="hover:text-[var(--y)] transition-colors">
              TERMS
            </Link>
            <Link href="/docs#privacy" className="hover:text-[var(--y)] transition-colors">
              PRIVACY
            </Link>
            <Link href="/docs" className="hover:text-[var(--y)] transition-colors">
              DOCS
            </Link>
          </div>
        </div>

        <p
          className="mono mt-6 text-[10px] tracking-[0.06em] leading-[1.6] max-w-4xl"
          style={{ color: "var(--g2)" }}
        >
          FHE MARKET IS A NON-CUSTODIAL PREDICTION MARKET PROTOCOL RUNNING ON SEPOLIA.
          ALL TRADES SETTLE ON-CHAIN IN cUSDT. TRADING INVOLVES RISK OF LOSS; USE ONLY
          FUNDS YOU CAN AFFORD TO LOSE. MARKETS RESOLVE ACCORDING TO THE RULES IN EACH
          MARKET&apos;S DESCRIPTION.
        </p>
      </div>
    </footer>
  );
}
