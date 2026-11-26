import { defineChain } from "viem";
import { bscTestnet } from "viem/chains";

export const LOCAL_RPC = process.env.NEXT_PUBLIC_LOCAL_RPC || "http://127.0.0.1:8545";

/** The local anvil chain the contracts' dev script deploys to. */
export const anvil = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: { default: { http: [LOCAL_RPC] } },
  testnet: true,
});

export { bscTestnet };
export const CHAINS = [anvil, bscTestnet] as const;

export function explorerTx(chainId: number, hash: string): string | null {
  if (chainId === 97) return `https://testnet.bscscan.com/tx/${hash}`;
  if (chainId === 56) return `https://bscscan.com/tx/${hash}`;
  return null;
}

export function explorerAddress(chainId: number, a: string): string | null {
  if (chainId === 97) return `https://testnet.bscscan.com/address/${a}`;
  if (chainId === 56) return `https://bscscan.com/address/${a}`;
  return null;
}

export function chainName(id: number): string {
  return id === 31337 ? "Anvil 31337" : id === 97 ? "BSC testnet" : id === 56 ? "BNB Chain" : `Chain ${id}`;
}

/** anvil's well-known, publicly documented unlocked test accounts (not secrets). #1 is the doc's 14 BNB buyer. */
export const ANVIL_ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
] as const;
