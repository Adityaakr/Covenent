import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc, bscTestnet } from 'viem/chains';
import type { ServerConfig } from './config.js';

export function chainFor(cfg: Pick<ServerConfig, 'chainId' | 'rpcUrl'>): Chain {
  if (cfg.chainId === 56) return bsc;
  if (cfg.chainId === 97) return bscTestnet;
  return defineChain({
    id: cfg.chainId,
    name: cfg.chainId === 31337 ? 'Local (anvil)' : `Chain ${cfg.chainId}`,
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
}

/** JSON-RPC batching instead of Multicall3: a bare anvil has no Multicall3 deployed. */
export function publicClient(cfg: Pick<ServerConfig, 'chainId' | 'rpcUrl'>): PublicClient {
  return createPublicClient({
    chain: chainFor(cfg),
    transport: http(cfg.rpcUrl, { batch: { batchSize: 64, wait: 0 }, retryCount: 2 }),
  }) as PublicClient;
}

export function walletClient(cfg: Pick<ServerConfig, 'chainId' | 'rpcUrl'>, privateKey: Hex): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: chainFor(cfg),
    transport: http(cfg.rpcUrl, { retryCount: 1 }),
  });
}

/**
 * Public networks are out of scope for this build. Anything that signs refuses to run against
 * BNB Chain mainnet unless COVENANT_ALLOW_PUBLIC_NETWORK=1 is set on purpose later.
 */
export function assertSigningAllowed(chainId: number): void {
  if ((chainId === 56 || chainId === 97) && process.env.COVENANT_ALLOW_PUBLIC_NETWORK !== '1') {
    throw new Error(
      `Refusing to sign on chain ${chainId}. This build is local-only; set COVENANT_ALLOW_PUBLIC_NETWORK=1 only when deploying for real.`,
    );
  }
}
