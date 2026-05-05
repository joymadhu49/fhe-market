"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { verifyMessage } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2, Shield, LogOut } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_ADDRESS } from "@/lib/constants";
import { shortenAddress } from "@/lib/utils";

const STORAGE_KEY = "fhe-market_admin_proof";

interface Proof {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
  issuedAt: number; // unix seconds
}

/** 4 hours. After this, the cached proof is ignored and the user re-signs. */
const PROOF_TTL_SECONDS = 4 * 60 * 60;

/** Build the message the wallet signs. Includes the domain, address, and a
 *  timestamp so replaying an old signature elsewhere doesn't match this app. */
function buildMessage(address: `0x${string}`): { message: string; issuedAt: number } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const domain =
    typeof window !== "undefined" ? window.location.host : "fhe-market";
  const message = [
    `${domain} wants you to sign in as the FHE Market admin:`,
    address,
    ``,
    `Prove ownership of this wallet to unlock the admin dashboard.`,
    `No gas, no on-chain tx.`,
    ``,
    `Issued At: ${new Date(issuedAt * 1000).toISOString()}`,
  ].join("\n");
  return { message, issuedAt };
}

/**
 * Gates the admin surface with a wallet signature. The signature proves
 * possession of the ADMIN_ADDRESS private key (a spoofed window.ethereum
 * can't produce one). Verification is client-side via viem.verifyMessage,
 * so no server session, no cookie, no env secret needed.
 *
 * The on-chain MarketFactory.owner check is the real security layer — this
 * component is a UX gate that keeps non-owners out of the dashboard.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [proof, setProof] = useState<Proof | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Load cached proof on mount (cancel-safe).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
        if (!raw) { if (!cancelled) setHydrated(true); return; }
        const parsed = JSON.parse(raw) as Proof;
        const now = Math.floor(Date.now() / 1000);
        if (!parsed?.signature || !parsed.address || now - parsed.issuedAt > PROOF_TTL_SECONDS) {
          sessionStorage.removeItem(STORAGE_KEY);
          if (!cancelled) setHydrated(true);
          return;
        }
        // Re-verify with viem every page load — cheap, prevents tampered storage.
        const ok = await verifyMessage({
          address: parsed.address,
          message: parsed.message,
          signature: parsed.signature,
        });
        if (cancelled) return;
        if (ok && parsed.address.toLowerCase() === ADMIN_ADDRESS) {
          setProof(parsed);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async () => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (address.toLowerCase() !== ADMIN_ADDRESS) {
      toast.error("This wallet is not the configured admin");
      return;
    }
    setSigningIn(true);
    try {
      const { message, issuedAt } = buildMessage(address);
      toast.loading("Waiting for wallet signature…", { id: "signin" });
      const signature = await signMessageAsync({ message });

      // Verify what we just got — catches wallets that lie about the address.
      const ok = await verifyMessage({ address, message, signature });
      if (!ok) throw new Error("Signature does not match the connected address");

      const p: Proof = { address, message, signature, issuedAt };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      setProof(p);
      toast.success("Signed in as admin", { id: "signin" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Sign-in failed: ${msg}`, { id: "signin" });
    } finally {
      setSigningIn(false);
    }
  }, [address, signMessageAsync]);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setProof(null);
    toast.success("Signed out");
  }, []);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-[#8b96a5]" />
      </div>
    );
  }

  if (!proof) {
    const walletIsAdmin = address && address.toLowerCase() === ADMIN_ADDRESS;
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-[4px] border border-[#1f2630] bg-[#131820] p-6">
          <div className="flex items-center gap-[8px] mb-3">
            <Shield className="h-[18px] w-[18px] text-[#f59e0b]" />
            <span className="mono label text-[#f59e0b]">Admin · sign-in required</span>
          </div>
          <h1 className="m-0 text-[18px] font-semibold tracking-[-0.3px] text-[#f3f4f6] mb-2">
            Sign in with the admin wallet
          </h1>
          <p className="m-0 text-[13px] leading-[1.6] text-[#8b96a5] mb-5">
            Connect the wallet at{" "}
            <span className="mono text-[#f3f4f6]">{shortenAddress(ADMIN_ADDRESS || "0x0")}</span>{" "}
            and sign a short message. The signature proves you hold the private key for
            this address — no gas, no transaction.
          </p>

          {!isConnected ? (
            <div className="flex justify-center">
              <ConnectButton showBalance={false} />
            </div>
          ) : !walletIsAdmin ? (
            <div className="rounded-[3px] border border-[#ef4444]/40 bg-[#ef4444]/10 p-3 text-[12px] text-[#ef4444]">
              Connected wallet ({shortenAddress(address ?? "")}) is not the admin.
              Switch to the admin wallet in your wallet extension.
            </div>
          ) : (
            <button
              onClick={signIn}
              disabled={signingIn}
              className="w-full rounded-[4px] border-none bg-gradient-to-r from-[#3b82f6] to-[#a855f7] px-4 py-[11px] text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {signingIn ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Signing…
                </span>
              ) : (
                "Sign in with wallet"
              )}
            </button>
          )}

          <p className="mt-4 mono text-[10px] tracking-[0.1em] uppercase text-[#6b7280] text-center">
            Proof stored in this tab only · clears when you close it
          </p>
        </div>
      </div>
    );
  }

  // Authed
  const mismatch = address && proof.address.toLowerCase() !== address.toLowerCase();
  return (
    <>
      {mismatch && (
        <div className="mx-4 sm:mx-6 lg:mx-8 my-3 rounded-[4px] border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3 text-[12px] text-[#f59e0b]">
          Signed in as {shortenAddress(proof.address)} but connected wallet is{" "}
          {shortenAddress(address ?? "")}. On-chain writes use the connected wallet;
          sign out and sign in again with the correct wallet.
        </div>
      )}
      <div className="flex justify-end px-4 sm:px-6 lg:px-8 pt-3">
        <button
          onClick={signOut}
          className="flex items-center gap-[6px] rounded-[3px] border border-[#1f2630] bg-[#131820] px-[10px] py-[5px] text-[11px] mono text-[#8b96a5] hover:text-[#f3f4f6] hover:border-[#2a3340] transition-colors"
        >
          <LogOut className="h-[11px] w-[11px]" />
          Sign out
          <span className="text-[#3a4250]">·</span>
          <span>{shortenAddress(proof.address)}</span>
        </button>
      </div>
      {children}
    </>
  );
}
