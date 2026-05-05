"use client";
/**
 * FHEVM relayer SDK init + helpers (browser bundle).
 *
 * Pattern mirrors agent-pay-fhe/web/lib/fhevm.ts. The browser bundle requires
 * COOP/COEP headers (set in next.config.ts) for SharedArrayBuffer.
 */
import { CUSDT_ADDRESS } from "./constants";

type FhevmInstance = Awaited<ReturnType<typeof createInstanceFn>>;

let _instance: FhevmInstance | null = null;
let _loadPromise: Promise<FhevmInstance> | null = null;

// Keep a single dynamic import so SSR doesn't try to load the browser bundle.
// Use the `/web` subpath: it ships the actual ES module with `initSDK` etc.
// (`/bundle` is only a thin re-export of `window.relayerSDK` for `<script>`
// loading and is undefined inside a normal Webpack/Turbopack import.)
async function loadModule() {
  return await import("@zama-fhe/relayer-sdk/web");
}

async function createInstanceFn(network: any) {
  const mod: any = await loadModule();
  if (typeof mod.initSDK === "function") await mod.initSDK();
  return await mod.createInstance({ ...mod.SepoliaConfig, network });
}

export async function getFhevm(): Promise<FhevmInstance> {
  if (_instance) return _instance;
  if (_loadPromise) return _loadPromise;
  if (typeof window === "undefined") {
    throw new Error("getFhevm() called outside the browser");
  }
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No injected wallet — open this page in a wallet-enabled browser");
  _loadPromise = createInstanceFn(eth).then((inst) => {
    _instance = inst;
    return inst;
  });
  return _loadPromise;
}

/**
 * Encrypt a single uint64 amount bound to (contract, user) and return the
 * client handle + input proof. The handle is fed into the contract's
 * `externalEuint64` parameter and the proof into `inputProof`.
 */
export async function encryptU64(
  contract: `0x${string}`,
  user: `0x${string}`,
  amount: bigint,
): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> {
  const fhe = await getFhevm();
  const buf = fhe.createEncryptedInput(contract, user);
  buf.add64(amount);
  const { handles, inputProof } = await buf.encrypt();
  return {
    handle: ("0x" + Buffer.from(handles[0]).toString("hex")) as `0x${string}`,
    inputProof: ("0x" + Buffer.from(inputProof).toString("hex")) as `0x${string}`,
  };
}

/**
 * Public-decrypt a snapshot handle (intent → execute flow). Returns cleartext
 * bigint + KMS proof bytes ready to feed into the executeBuy/Sell/Claim call.
 */
export async function publicDecrypt(handle: `0x${string}`): Promise<{ value: bigint; proof: `0x${string}` }> {
  const fhe = await getFhevm();
  const result = await fhe.publicDecrypt([handle]);
  return {
    value: BigInt(result.clearValues[handle]),
    proof: result.decryptionProof as `0x${string}`,
  };
}

/**
 * User-decrypt a single ciphertext via EIP-712. Used by "my YES/NO position"
 * panels — only the signer can read the cleartext.
 */
export async function userDecryptU64(
  handle: `0x${string}`,
  contract: `0x${string}`,
  user: `0x${string}`,
  signTypedData: (params: {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  }) => Promise<`0x${string}`>,
): Promise<bigint> {
  const fhe = await getFhevm();
  const { publicKey, privateKey } = fhe.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const eip712 = fhe.createEIP712(publicKey, [contract], startTimestamp, durationDays);
  const sig = await signTypedData({
    domain: eip712.domain,
    types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    primaryType: "UserDecryptRequestVerification",
    message: eip712.message,
  });
  const result = await fhe.userDecrypt(
    [{ handle, contractAddress: contract }],
    privateKey,
    publicKey,
    sig.replace(/^0x/, ""),
    [contract],
    user,
    startTimestamp,
    durationDays,
  );
  return BigInt(result[handle]);
}

/**
 * Convenience: cUSDT operator approval window (24h). Caller signs a regular
 * wagmi tx — no encryption needed.
 */
export function operatorDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
}

export const CUSDT = CUSDT_ADDRESS;
