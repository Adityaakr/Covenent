import { getAddress, isAddress, parseEther, parseUnits, type Address, type Hex, type PublicClient } from 'viem';
import { isLoopbackRpc, walletClient } from '../chain.js';
import { deploymentAddress, type ServerConfig } from '../config.js';

/**
 * "Get test funds" for the LOCAL dev chain only: sends test BNB from an anvil account and mints Demo USDC (dUSDC, a
 * 6-decimal token scripts/dev-funds.sh deploys with that account as its only minter). Refuses on any chain that is not
 * a loopback node, whatever its chain id, so it can never move value on a public network.
 */
export interface FaucetResult {
  address: Address;
  bnbWei: string;
  bnbTx: Hex;
  usdc: string | null;
  usdcTx: Hex | null;
  label: string;
}

const MINT_ABI = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

export class FaucetError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class Faucet {
  private last = new Map<string, number>();
  constructor(
    private cfg: ServerConfig,
    private client: PublicClient,
    private opts = {
      bnb: process.env.FAUCET_BNB ?? '10',
      usdc: process.env.FAUCET_USDC ?? '10000',
      cooldownMs: Number(process.env.FAUCET_COOLDOWN_SECONDS ?? 30) * 1000,
    },
  ) {}

  /** Why the faucet is off, or null when it can pay out. */
  disabledReason(): string | null {
    if (!isLoopbackRpc(this.cfg.rpcUrl)) return `the chain at ${this.cfg.rpcUrl} is not a local node; test funds exist only on the dev chain`;
    if (!process.env.FAUCET_PRIVATE_KEY) return 'FAUCET_PRIVATE_KEY is not set (scripts/dev-all.sh sets anvil account #0)';
    return null;
  }

  status() {
    const why = this.disabledReason();
    return {
      enabled: why === null,
      reason: why,
      bnb: this.opts.bnb,
      usdc: this.usdcAddress() ? this.opts.usdc : null,
      demoUsdc: this.usdcAddress() ?? null,
      demoUsdcPair: deploymentAddress(this.cfg.deployments, 'demoUsdcPair') ?? null,
      router: deploymentAddress(this.cfg.deployments, 'router') ?? null,
      wbnb: this.cfg.wbnb ?? null,
      label: 'Local test funds: anvil test BNB and Demo USDC on the dev chain. Worthless anywhere else.',
    };
  }

  private usdcAddress(): Address | undefined {
    return deploymentAddress(this.cfg.deployments, 'demoUsdc');
  }

  async send(to: string): Promise<FaucetResult> {
    const why = this.disabledReason();
    if (why) throw new FaucetError(403, `faucet off: ${why}`);
    if (!isAddress(to)) throw new FaucetError(400, 'address must be a 0x address');
    const address = getAddress(to);
    const prev = this.last.get(address) ?? 0;
    if (Date.now() - prev < this.opts.cooldownMs) {
      throw new FaucetError(429, `test funds were just sent to ${address}; try again in ${Math.ceil((prev + this.opts.cooldownMs - Date.now()) / 1000)} s`);
    }
    this.last.set(address, Date.now());
    const w = walletClient(this.cfg, process.env.FAUCET_PRIVATE_KEY as Hex);
    const account = w.account!;
    const value = parseEther(this.opts.bnb);
    const bnbTx = await w.sendTransaction({ account, chain: w.chain, to: address, value });
    await this.client.waitForTransactionReceipt({ hash: bnbTx });
    const usdc = this.usdcAddress();
    let usdcTx: Hex | null = null;
    if (usdc) {
      usdcTx = await w.writeContract({ account, chain: w.chain, address: usdc, abi: MINT_ABI, functionName: 'mint', args: [address, parseUnits(this.opts.usdc, 6)] });
      await this.client.waitForTransactionReceipt({ hash: usdcTx });
    }
    return {
      address,
      bnbWei: value.toString(),
      bnbTx,
      usdc: usdc ? this.opts.usdc : null,
      usdcTx,
      label: 'Local test funds (dev chain only)',
    };
  }
}
