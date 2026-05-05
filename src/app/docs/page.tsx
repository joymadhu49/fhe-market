import Link from "next/link";
import type { Metadata } from "next";
import {
  CUSDT_ADDRESS,
  USDT_MOCK_ADDRESS,
  FACTORY_ADDRESS,
  TREASURY_ADDRESS,
  PLATFORM_FEE_BPS,
} from "@/lib/constants";
import FaucetButton from "@/components/FaucetButton";
import PixelDebris from "@/components/ui/PixelDebris";
import LockGlyph from "@/components/ui/LockGlyph";

export const metadata: Metadata = {
  title: "Docs — FHE Market",
  description:
    "How FHE Market's confidential prediction markets work on Zama FHEVM: encrypted positions, intent/execute flow, ERC-7984 settlement, EIP-712 user-decrypt.",
};

const NAV: [string, [string, string][]][] = [
  ["GET STARTED", [
    ["Overview", "#overview"],
    ["Privacy model", "#privacy-model"],
    ["Faucet", "#faucet"],
    ["How it works", "#how-it-works"],
  ]],
  ["FLOWS", [
    ["Intent → Execute", "#intent-execute"],
    ["Decryption flows", "#decryption"],
    ["Trading", "#trading"],
  ]],
  ["PROTOCOL", [
    ["Fees", "#fees"],
    ["Resolution", "#resolution"],
    ["Stack & versions", "#stack"],
  ]],
  ["RESOURCES", [
    ["Contracts", "#contracts"],
    ["FAQ", "#faq"],
    ["Support", "#support"],
  ]],
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[140px]">
      <h2
        className="display mb-4"
        style={{ fontSize: 26, color: "var(--k)", letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      <div className="text-[14px] leading-[1.7] space-y-4" style={{ color: "var(--g3)" }}>
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="mono text-[12px] px-1.5 py-[1px]"
      style={{ background: "var(--w)", border: "1px solid var(--k)", color: "var(--k)" }}
    >
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre
      className="mono text-[12px] leading-[1.55] px-4 py-3 overflow-x-auto"
      style={{ background: "var(--k)", color: "var(--g0)", border: "2px solid var(--k)" }}
    >
      <code>{children}</code>
    </pre>
  );
}

function ContractRow({
  name,
  address,
  href,
  sub,
}: {
  name: string;
  address: string;
  href?: string;
  sub?: string;
}) {
  const content = (
    <div
      className="flex items-center justify-between px-3 py-2.5 transition-colors group"
      style={{ background: "var(--w)", border: "2px solid var(--k)" }}
    >
      <div className="min-w-0">
        <div className="font-bold text-[13px]" style={{ color: "var(--k)" }}>
          {name}
        </div>
        {sub && (
          <div className="mono text-[10px] mt-0.5" style={{ color: "var(--g2)" }}>
            {sub}
          </div>
        )}
      </div>
      <span
        className="mono text-[11px] truncate ml-3 group-hover:text-[var(--blue)]"
        style={{ color: "var(--g2)" }}
      >
        {address}
      </span>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">{content}</a>
  ) : content;
}

function PrivacyTable() {
  const rows: { label: string; pub: boolean; enc: boolean; note?: string }[] = [
    { label: "Pool reserves (yesReserve, noReserve)", pub: true, enc: false, note: "CPMM math needs cleartext" },
    { label: "Market metadata", pub: true, enc: false },
    { label: "YES/NO price", pub: true, enc: false },
    { label: "Per-user share balance", pub: false, enc: true, note: "euint64" },
    { label: "Trade size (your tx)", pub: false, enc: true, note: "ciphertext input" },
    { label: "Position aggregate (PnL)", pub: false, enc: true, note: "client-decrypt" },
    { label: "Settlement payout", pub: true, enc: true, note: "total public · per-user encrypted" },
  ];
  return (
    <div style={{ border: "2px solid var(--k)" }}>
      <div
        className="mono grid items-center text-[11px] tracking-[0.14em] font-bold"
        style={{ gridTemplateColumns: "1.6fr 1fr 1fr", background: "var(--k)", color: "var(--w)" }}
      >
        <div className="px-4 py-3" style={{ borderRight: "1px solid #222" }}>LAYER</div>
        <div className="px-4 py-3" style={{ borderRight: "1px solid #222" }}>PUBLIC</div>
        <div className="px-4 py-3">ENCRYPTED</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          className="grid items-center text-[12.5px]"
          style={{
            gridTemplateColumns: "1.6fr 1fr 1fr",
            background: i % 2 ? "rgba(15,20,27,0.03)" : "var(--w)",
            borderTop: i ? "1px solid var(--g1)" : "none",
          }}
        >
          <div className="px-4 py-3 font-semibold" style={{ color: "var(--k)" }}>
            {r.label}
            {r.note && <span className="mono text-[10px] ml-2" style={{ color: "var(--g2)" }}>· {r.note}</span>}
          </div>
          <div
            className="mono px-4 py-3"
            style={{ color: r.pub ? "var(--k)" : "var(--g2)", fontWeight: r.pub ? 700 : 400 }}
          >
            {r.pub ? "✓" : "—"}
          </div>
          <div
            className="mono px-4 py-3 flex items-center"
            style={{ color: r.enc ? "var(--blue)" : "var(--g2)", fontWeight: r.enc ? 700 : 400 }}
          >
            {r.enc ? (
              <span
                className="inline-flex items-center justify-center"
                style={{ width: 22, height: 22, background: "var(--y)", border: "1.5px solid var(--k)" }}
              >
                <LockGlyph size={14} />
              </span>
            ) : (
              "—"
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlowCard({
  n,
  title,
  body,
  code,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
  code?: string;
}) {
  return (
    <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "60px 1fr" }}>
      <div
        className="grid place-items-center mono font-bold"
        style={{
          width: 56,
          height: 56,
          background: "var(--y)",
          color: "var(--k)",
          border: "2px solid var(--k)",
          fontSize: 22,
        }}
      >
        {n}
      </div>
      <div>
        <div className="display" style={{ fontSize: 18, color: "var(--k)" }}>{title}</div>
        <p className="text-[14px] leading-[1.6] mt-2 mb-3" style={{ color: "var(--g3)" }}>
          {body}
        </p>
        {code && <CodeBlock>{code}</CodeBlock>}
      </div>
    </div>
  );
}

export default function DocsPage() {
  const feePct = (PLATFORM_FEE_BPS / 100).toFixed(2);
  const explorer = (a: string) => `https://sepolia.etherscan.io/address/${a}`;

  return (
    <div style={{ background: "var(--g0)" }}>
      <div className="mx-auto max-w-[1400px] grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside
          className="lg:sticky lg:top-[112px] lg:self-start py-8 px-5"
          style={{ background: "var(--w)", borderRight: "2px solid var(--k)", minHeight: "100vh" }}
        >
          <div className="mono text-[10px] tracking-[0.18em]" style={{ color: "var(--g2)" }}>
            v0.1 · TESTNET
          </div>
          <div className="display mt-1 mb-6" style={{ fontSize: 22, color: "var(--k)" }}>
            Docs
          </div>
          {NAV.map(([h, items]) => (
            <div key={h} className="mb-5">
              <div
                className="mono text-[10px] tracking-[0.14em] font-bold mb-2"
                style={{ color: "var(--g2)" }}
              >
                {h}
              </div>
              <div className="grid gap-1">
                {items.map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    className="mono text-[12px] px-2 py-1.5 hover:bg-[var(--y)] transition-colors"
                    style={{ color: "var(--g3)" }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Content */}
        <main className="px-4 sm:px-6 lg:px-12 py-10 space-y-12">
          <header>
            <div className="mono text-[10px] tracking-[0.14em]" style={{ color: "var(--g2)" }}>
              PROTOCOL / PRIVACY MODEL
            </div>
            <h1
              className="display mt-2 mb-3"
              style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.05, color: "var(--k)", letterSpacing: "-0.02em", maxWidth: 760 }}
            >
              Pool public, position private.
            </h1>
            <p className="text-[15px] leading-[1.6]" style={{ color: "var(--g3)", maxWidth: 760 }}>
              FHE Market keeps the AMM math gas-affordable by leaving pool reserves in cleartext,
              while every user&apos;s share balance lives as a Zama <Code>euint64</Code> ciphertext.
              Only the holder — not the relayer, not the contract, not the indexer — can read the value.
            </p>
          </header>

          {/* Yellow threat-model callout */}
          <div
            className="relative overflow-hidden p-5"
            style={{ background: "var(--y)", border: "2px solid var(--k)" }}
          >
            <PixelDebris count={8} seed={5} />
            <div className="eyebrow mb-2" style={{ color: "var(--k)" }}>▮ THREAT MODEL</div>
            <div
              className="text-[16px] leading-[1.55] font-semibold"
              style={{ color: "var(--k)", maxWidth: 720 }}
            >
              An adversary watching the chain in real time learns the market price and pool size.
              They never learn which side <em>you</em> took, nor your size — even after settlement.
            </div>
          </div>

          <Section id="overview" title="Overview">
            <p>
              FHE Market is a non-custodial, confidential prediction-market protocol. Each market
              asks a binary question. Users buy <Code>YES</Code> or <Code>NO</Code> shares against
              a Polymarket-style FPMM. Winning shares redeem 1:1 for cUSDT at resolution.
            </p>
            <p>
              The twist: <strong style={{ color: "var(--k)" }}>per-user share balances are
              encrypted on-chain</strong>. Outsiders can see the pool, the price, and the
              outcome — they <em>cannot</em> see your YES/NO position, your cumulative
              exposure, or how a particular wallet leans. Only you, holding the right EIP-712
              signature, can decrypt your own balance.
            </p>
          </Section>

          <Section id="privacy-model" title="What's encrypted">
            <PrivacyTable />
            <p className="text-[12.5px]" style={{ color: "var(--g2)" }}>
              The bet amount on a single transaction reveals at the <Code>executeBuy</Code> step
              (necessary to update reserves), but your cumulative position across many bets stays
              opaque — an observer cannot link multiple actions to a single position size without
              breaking FHE.
            </p>
          </Section>

          {/* Faucet */}
          <section
            id="faucet"
            className="relative overflow-hidden p-7 grid gap-7 lg:grid-cols-[1fr_auto] items-center scroll-mt-[140px]"
            style={{ background: "var(--y)", border: "2px solid var(--k)" }}
          >
            <PixelDebris count={12} seed={2} />
            <div className="relative z-[3]">
              <div className="eyebrow mb-2" style={{ color: "var(--k)" }}>FAUCET</div>
              <div className="display" style={{ fontSize: 28, lineHeight: 1.1, color: "var(--k)" }}>
                Drip 5 cUSDT to your wallet.
              </div>
              <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: "var(--k)", maxWidth: 560 }}>
                One on-chain <Code>Faucet.drip(you, 5)</Code> bundles{" "}
                <Code>USDTMock.mint × 5</Code> + <Code>approve</Code> + <Code>cUSDT.wrap</Code> in
                a single user-signed tx. No relayer round-trip; encrypted balance ready for an
                EIP-712 reveal in your bet panel.
              </p>
              <div
                className="mono mt-3 text-[10px] tracking-[0.14em]"
                style={{ color: "var(--k)" }}
              >
                1 WALLET POP · ~15s · GAS PAID IN ETH
              </div>
            </div>
            <div className="relative z-[3]">
              <FaucetButton count={5} />
            </div>
          </section>

          <Section id="how-it-works" title="How it works">
            <p>
              Each market is a standalone <Code>PredictionMarket</Code> contract using a
              Fixed-Product Market Maker (FPMM). Two cleartext reserves —{" "}
              <Code>yesReserve</Code> and <Code>noReserve</Code> — sit on the constant-product
              curve <Code>k = yesReserve · noReserve</Code>. Buying YES removes YES from the pool,
              pushing implied probability up; selling does the reverse. Prices stay between $0.00
              and $1.00 and sum to one.
            </p>
            <ol className="list-decimal ml-5 space-y-1.5 text-[13.5px]" style={{ color: "var(--g3)" }}>
              <li>Factory deploys a market and seeds it with cUSDT pulled from the treasury.</li>
              <li>Trader runs <Code>setOperator</Code> on cUSDT, then submits <Code>buyIntent</Code>.</li>
              <li>Zama relayer publicly decrypts the transferred ciphertext (~10–60s on Sepolia).</li>
              <li><Code>executeBuy</Code> runs CPMM math, mints encrypted shares, forwards fee.</li>
              <li>At resolve time, factory submits the outcome.</li>
              <li>Winners trigger <Code>claimIntent</Code> → relayer decrypt → <Code>executeClaim</Code>.</li>
            </ol>
          </Section>

          <Section id="intent-execute" title="Buy flow · Intent → Execute">
            <p>
              Buy, sell, and claim split into <em>intent</em> + <em>execute</em>. The intent locks
              an encrypted snapshot and marks it <Code>publiclyDecryptable</Code>; the execute step
              verifies the relayer&apos;s cleartext via <Code>FHE.checkSignatures</Code> and then
              settles. Latency between the two is the relayer round-trip, ~10–60s on Sepolia.
            </p>
            <div className="space-y-6">
              <FlowCard
                n="01"
                title="Submit encrypted intent"
                body={
                  <>
                    Frontend encrypts your trade size client-side. <Code>buyIntent</Code> calls
                    {" "}<Code>cUSDT.confidentialTransferFrom</Code>, snapshots the actually-transferred
                    ciphertext, marks it publicly decryptable.
                  </>
                }
                code={`const ct = await fhe.encryptU64(amount, market, user);
await market.buyIntent(side, ct.handle, ct.proof, minSharesOut);`}
              />
              <FlowCard
                n="02"
                title="Relayer decrypt (no read)"
                body={
                  <>
                    Frontend reads <Code>pendingBuyHandle(user)</Code>, calls
                    {" "}<Code>relayer.publicDecrypt(handle)</Code>. Relayer returns cleartext + KMS proof.
                  </>
                }
                code={`const r = await fhe.publicDecrypt([handle]);
// { clearValues, decryptionProof }`}
              />
              <FlowCard
                n="03"
                title="Settle on-chain"
                body={
                  <>
                    Anyone calls <Code>executeBuy(user, cleartext, proof)</Code>. Contract verifies
                    via <Code>FHE.checkSignatures</Code>, runs CPMM math, mints encrypted shares,
                    forwards the protocol fee.
                  </>
                }
                code={`await market.executeBuy(user, cleartext, proof);`}
              />
            </div>
            <p className="text-[12.5px]" style={{ color: "var(--g2)" }}>
              Sells branchlessly clamp the user&apos;s input to their encrypted balance via{" "}
              <Code>FHE.le</Code> + <Code>FHE.select</Code> in the intent step — selling more than
              you own can&apos;t leak comparison results because the clamp happens entirely in
              ciphertext. The clamped value is what gets revealed.
            </p>
          </Section>

          <Section id="decryption" title="Decryption flows">
            <p>Two paths take cleartext off-chain.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div style={{ background: "var(--w)", border: "2px solid var(--k)" }} className="p-4">
                <div className="mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--blue)" }}>
                  USER-DECRYPT
                </div>
                <div className="display mt-1" style={{ fontSize: 17, color: "var(--k)" }}>
                  &quot;my YES/NO position&quot;
                </div>
                <p className="text-[12.5px] mt-2 leading-[1.6]" style={{ color: "var(--g3)" }}>
                  User signs an EIP-712 typed message; relayer returns a re-encryption keyed to
                  the signer. Decryption happens client-side. Powers the
                  {" "}<strong>Reveal</strong> button on every market page.
                </p>
              </div>
              <div style={{ background: "var(--w)", border: "2px solid var(--k)" }} className="p-4">
                <div className="mono text-[10px] tracking-[0.14em] font-bold" style={{ color: "var(--blue)" }}>
                  PUBLIC-DECRYPT
                </div>
                <div className="display mt-1" style={{ fontSize: 17, color: "var(--k)" }}>
                  Settlement
                </div>
                <p className="text-[12.5px] mt-2 leading-[1.6]" style={{ color: "var(--g3)" }}>
                  Used at <Code>executeBuy</Code>, <Code>executeSell</Code>, <Code>executeClaim</Code>.
                  Cleartext + KMS proof submit on-chain; <Code>FHE.checkSignatures</Code> verifies
                  before settlement.
                </p>
              </div>
            </div>
          </Section>

          <Section id="trading" title="Trading">
            <ul className="list-disc ml-5 space-y-1.5 text-[13.5px]" style={{ color: "var(--g3)" }}>
              <li>Connect wallet on Sepolia, open any market, enter cUSDT amount or shares.</li>
              <li>First interaction signs <Code>cUSDT.setOperator(market, until)</Code> — a 24h permission.</li>
              <li>Minimum bet is <Code>0.01 cUSDT</Code> so fees never round to zero.</li>
              <li>Each action is two wallet pops (intent + execute) plus a relayer wait between.</li>
            </ul>
          </Section>

          <Section id="fees" title="Fees">
            <p>
              Flat platform fee of <strong style={{ color: "var(--k)" }}>{feePct}%</strong> on
              both buy and sell. Forwarded on-chain to <Code>Treasury</Code> via
              {" "}<Code>cUSDT.confidentialTransfer</Code>. No deposit/withdraw fees, no spread.
            </p>
            <p className="text-[12.5px]" style={{ color: "var(--g2)" }}>
              Capped on-chain by <Code>MAX_FEE_BPS = 500</Code> (5%), owner-tunable below that.
            </p>
          </Section>

          <Section id="resolution" title="Resolution">
            <ul className="list-disc ml-5 space-y-1.5 text-[13.5px]" style={{ color: "var(--g3)" }}>
              <li><strong style={{ color: "var(--k)" }}>YES / NO:</strong> winning shares redeem 1 cUSDT each via the 2-tx claim flow.</li>
              <li><strong style={{ color: "var(--k)" }}>CANCELLED:</strong> all positions refund — both YES and NO 1:1.</li>
              <li>After all winners claim, factory sweeps residual cUSDT back to treasury.</li>
            </ul>
          </Section>

          <Section id="contracts" title="Contracts (Sepolia)">
            <p>
              Live, Etherscan-verified addresses. Market addresses come from
              {" "}<Code>MarketFactory.getAllMarkets()</Code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ContractRow name="MarketFactory" address={FACTORY_ADDRESS} href={explorer(FACTORY_ADDRESS)} sub="DEPLOYS · FUNDS · RESOLVES" />
              <ContractRow name="Treasury" address={TREASURY_ADDRESS} href={explorer(TREASURY_ADDRESS)} sub="HOLDS cUSDT · SEEDS NEW MARKETS" />
              <ContractRow name="cUSDT (ERC-7984)" address={CUSDT_ADDRESS} href={explorer(CUSDT_ADDRESS)} sub="CONFIDENTIAL SETTLEMENT TOKEN" />
              <ContractRow name="USDTMock" address={USDT_MOCK_ADDRESS} href={explorer(USDT_MOCK_ADDRESS)} sub="PUBLIC MINT · 1 USDT/CALL CAP" />
            </div>
          </Section>

          <Section id="stack" title="Stack & versions">
            <CodeBlock>{`Contracts
  @fhevm/solidity         0.11.1
  @fhevm/hardhat-plugin   0.4.2
  @openzeppelin/contracts ^5.1.0
  hardhat                 ^2.28.4
  solc                    0.8.27 + cancun + viaIR

Frontend
  next                    16.2.4
  wagmi                   ^2.19
  viem                    ^2.48
  @rainbow-me/rainbowkit  ^2.2
  @zama-fhe/relayer-sdk   0.4.1`}</CodeBlock>
            <p className="text-[12.5px]" style={{ color: "var(--g2)" }}>
              Browser bundle requires <Code>Cross-Origin-Opener-Policy: same-origin</Code> +{" "}
              <Code>Cross-Origin-Embedder-Policy: require-corp</Code> for SharedArrayBuffer
              (configured in <Code>next.config.ts</Code>).
            </p>
          </Section>

          <Section id="faq" title="FAQ">
            <div className="space-y-4">
              {[
                {
                  q: "Why are reserves public if shares are encrypted?",
                  a: "Encrypting reserves would force FHE.mul/FHE.div on two ciphertexts per trade — gas explodes by orders of magnitude. Keeping reserves public is the practical FHEVM trade-off.",
                },
                {
                  q: "Why is each action two transactions?",
                  a: "CPMM math needs cleartext numbers. The relayer's public-decryption oracle has to sign the value off-chain (~10–60s). Intent locks the snapshot; execute settles after the signed cleartext lands.",
                },
                {
                  q: "What can my wallet's position leak?",
                  a: "Per-tx amounts leak at execute-time. Cumulative position, total YES vs NO ratio, and final share count don't.",
                },
                {
                  q: "Where do I get cUSDT?",
                  a: "Hit the in-app Faucet — one tx, 5 cUSDT into your wallet.",
                },
              ].map((f) => (
                <div key={f.q}>
                  <div className="font-bold text-[14px] mb-1" style={{ color: "var(--k)" }}>{f.q}</div>
                  <p className="m-0 text-[13.5px]" style={{ color: "var(--g3)" }}>{f.a}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="support" title="Support">
            <p>
              Source + issues:{" "}
              <a
                href="https://github.com/joymadhu49/fhe-market"
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: "var(--blue)" }}
              >
                github.com/joymadhu49/fhe-market
              </a>
              . Twitter:{" "}
              <a href="https://x.com/zx_joy_" target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--blue)" }}>
                @zx_joy_
              </a>
              .
            </p>
            <p className="text-[12.5px]" style={{ color: "var(--g2)" }}>
              FHE Market is provided &quot;as is&quot; on Sepolia for research and evaluation.
              Trading involves risk of loss; do not deposit funds you cannot afford to lose.
            </p>
          </Section>

          <div
            className="pt-6 flex items-center justify-between mono text-[10px] tracking-[0.12em]"
            style={{ borderTop: "2px solid var(--k)", color: "var(--g2)" }}
          >
            <span>LAST UPDATED {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()}</span>
            <Link href="/" className="hover:text-[var(--k)] transition-colors">
              ← BACK TO MARKETS
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
