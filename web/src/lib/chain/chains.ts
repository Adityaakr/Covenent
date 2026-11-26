import { defineChain } from "viem";
import { bscTestnet } from "viem/chains";

export const LOCAL_RPC = process.env.NEXT_PUBLIC_LOCAL_RPC || "http://127.0.0.1:8545";

export interface LocalChainInfo { id: number; rpcUrl: string; mode?: string }

const isLoopback = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);

/**
 * A viem chain for the dev node. Its id comes from contracts/deployments/local.json: 31337 offline, 56 on a BNB Chain
 * fork (Flap's Portal refuses other ids). Every RPC URL, including the one Privy's embedded wallet uses
 * (privyWalletOverride), points at the local node, so nothing is ever sent to a public network from here.
 */
export function makeLocalChain(info: LocalChainInfo) {
  const rpc = info.rpcUrl || LOCAL_RPC;
  return defineChain({
    id: info.id,
    name: info.id === 97 ? "BNB Smart Chain Testnet" : info.id === 56 ? (isLoopback(rpc) ? "BNB Chain fork (local)" : "BNB Smart Chain") : info.id === 31337 ? "Anvil (local)" : `Local chain ${info.id}`,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: [rpc] }, privyWalletOverride: { http: [rpc] } },
    testnet: info.id !== 56 || isLoopback(rpc),
  });
}

/**
 * The local chain the contracts' dev script deploys to. `configureLocalChain` (called by Providers with the ids the
 * /app layout reads from local.json on each request) replaces it before any wallet config is built; importers see
 * the new value through the ES module live binding.
 */
export let anvil = makeLocalChain({ id: 31337, rpcUrl: LOCAL_RPC });
let localIsLoopback = true;

export function configureLocalChain(info: LocalChainInfo | null | undefined) {
  if (!info || (info.id === anvil.id && info.rpcUrl === anvil.rpcUrls.default.http[0])) return;
  anvil = makeLocalChain(info);
  localIsLoopback = isLoopback(info.rpcUrl || LOCAL_RPC);
}

export { bscTestnet };

/** BNB Chain's own testnet faucet: test BNB on chain 97 comes from here, never from the dev stack's faucet. */
export const TESTNET_FAUCET = "https://www.bnbchain.org/en/testnet-faucet";

/** No explorer for the local node: a hash on a local fork of BNB Chain does not exist on BscScan. */
const isLocal = (chainId: number) => chainId === anvil.id && localIsLoopback;

export function explorerTx(chainId: number, hash: string): string | null {
  if (isLocal(chainId)) return null;
  if (chainId === 97) return `https://testnet.bscscan.com/tx/${hash}`;
  if (chainId === 56) return `https://bscscan.com/tx/${hash}`;
  return null;
}

export function explorerAddress(chainId: number, a: string): string | null {
  if (isLocal(chainId)) return null;
  if (chainId === 97) return `https://testnet.bscscan.com/address/${a}`;
  if (chainId === 56) return `https://bscscan.com/address/${a}`;
  return null;
}

export function chainName(id: number): string {
  if (isLocal(id)) return id === 56 ? "BNB fork (local)" : id === 31337 ? "Anvil (local)" : `Local chain ${id}`;
  return id === 31337 ? "Anvil (local)" : id === 97 ? "BNB testnet" : id === 56 ? "BNB Chain" : `Chain ${id}`;
}

export type NetworkKind = "local" | "testnet" | "mainnet" | "other";

/** What the configured chain is: a node on this machine (anvil, a BNB fork), BNB testnet or BNB Chain. */
export function networkKind(id: number | undefined): NetworkKind {
  if (id === undefined || isLocal(id)) return "local";
  return id === 97 ? "testnet" : id === 56 ? "mainnet" : "other";
}

/** Where test BNB comes from: the dev stack's faucet page locally, BNB Chain's faucet on testnet, none on mainnet. */
export function faucetFor(id: number | undefined): { href: string; label: string; external: boolean } | null {
  const k = networkKind(id);
  if (k === "local") return { href: "/app/faucet", label: "Get test funds", external: false };
  if (k === "testnet") return { href: TESTNET_FAUCET, label: "BNB testnet faucet", external: true };
  return null;
}

/** anvil's public test accounts are offered only when the configured chain is a node on this machine. */
export function localAccountsAllowed(): boolean {
  return localIsLoopback && (anvil.id === 31337 || anvil.id === 56);
}

/** The command that starts the stack for the configured chain. */
export function stackCommand(id: number | undefined): string {
  return networkKind(id) === "testnet" ? "scripts/testnet-up.sh" : "scripts/dev-all.sh";
}

/** anvil's well-known, publicly documented unlocked test accounts (not secrets). #1 is the doc's 14 BNB buyer. */
export const ANVIL_ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
] as const;

/** The dev stack's role for each account (contracts/deployments/local.json `accounts`). #9 signs Atlas reports. */
export const ANVIL_ROLES = ["deployer", "team / issuer agent", "buyer 1 (the 14 BNB buyer)", "buyer 2", "buyer 3 / investor agent", "whale", "keeper", "trader", "relayer"] as const;
