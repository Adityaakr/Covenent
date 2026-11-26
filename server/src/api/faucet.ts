import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { formatEther, getAddress, isAddress, parseEther, parseUnits, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isLocalDevNode, isLoopbackRpc, walletClient } from '../chain.js';
import { redactUrl } from '../safety.js';
import { deploymentAddress, type ServerConfig } from '../config.js';

/**
 * Test funds, in two modes and nowhere else:
 *
 * - local: the dev chain (any chain id on a loopback node). Sends test BNB from an anvil account and mints Demo USDC
 *   (dUSDC, a 6-decimal token scripts/dev-funds.sh deploys with that account as its only minter).
 * - testnet: BNB Smart Chain Testnet (chain 97, checked against the RPC) with TESTNET_FAUCET_PRIVATE_KEY set. Sends a
 *   small tBNB drip for gas and a first commitment, once per address and once per IP every 24 hours, under a daily
 *   cap, and refuses with BNB Chain's public faucets when its own balance runs low. It mints dUSDC only if a demoUsdc
 *   address is recorded for chain 97 (no covenant flow on testnet uses one: raises are in BNB).
 *
 * Any other network (BNB Chain mainnet included) has no faucet, whatever key is set.
 */
export interface FaucetResult {
  address: Address;
  bnbWei: string;
  bnbTx: Hex;
  usdc: string | null;
  usdcTx: Hex | null;
  label: string;
}

/** Where testers get tBNB when this faucet is dry or has already paid them today. */
export const PUBLIC_FAUCETS = [
  { name: 'BNB Chain faucet', url: 'https://www.bnbchain.org/en/testnet-faucet' },
  { name: 'QuickNode faucet', url: 'https://faucet.quicknode.com/binance-smart-chain/bnb-testnet' },
  { name: 'Chainlink faucet', url: 'https://faucets.chain.link/bnb-chain-testnet' },
] as const;

const MINT_ABI = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const;
const MINTER_ABI = [{ type: 'function', name: 'minter', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;

export class FaucetError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const envNum = (name: string, fallback: string) => process.env[name] ?? fallback;

export interface TestnetFaucetOpts {
  /** tBNB per drip */
  drip: string;
  /** tBNB the faucet pays out per UTC day, all addresses together */
  dailyCap: string;
  /** an address already holding this much tBNB is told it has enough */
  enough: string;
  /** kept back for the faucet's own gas: below drip + reserve the faucet is dry */
  reserve: string;
  cooldownMs: number;
  stateFile: string;
}

interface Ledger {
  day: string;
  paidWei: string;
  byAddress: Record<string, number>;
  byIp: Record<string, number>;
}

/** The testnet drip's ledger on disk, so a restart neither resets the limits nor forgets the day's total. */
class LedgerFile {
  constructor(private file: string) {}
  read(now: number): Ledger {
    const day = new Date(now).toISOString().slice(0, 10);
    let l: Ledger = { day, paidWei: '0', byAddress: {}, byIp: {} };
    try {
      if (existsSync(this.file)) l = { ...l, ...(JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Ledger>) };
    } catch {
      /* a corrupt ledger starts over; limits are a courtesy, the balance check still holds */
    }
    if (l.day !== day) l = { ...l, day, paidWei: '0' };
    const fresh = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).filter(([, t]) => now - t < DAY_MS));
    return { ...l, byAddress: fresh(l.byAddress), byIp: fresh(l.byIp) };
  }
  write(l: Ledger) {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(l, null, 2));
    renameSync(tmp, this.file);
  }
}

type Signer = Pick<WalletClient, 'sendTransaction' | 'writeContract' | 'account' | 'chain'>;

export interface FaucetDeps {
  local?: { bnb: string; usdc: string; cooldownMs: number };
  testnet?: Partial<TestnetFaucetOpts>;
  now?: () => number;
  /** the signer for a key (tests pass a fake; the server signs with viem over cfg.rpcUrl) */
  wallet?: (key: Hex) => Signer;
}

export class Faucet {
  private last = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();
  private rpcChain: Promise<number> | null = null;
  private ledger: LedgerFile;
  private opts: { bnb: string; usdc: string; cooldownMs: number };
  private now: () => number;
  private wallet: (key: Hex) => Signer;
  readonly testnet: TestnetFaucetOpts;
  constructor(
    private cfg: ServerConfig,
    private client: PublicClient,
    deps: FaucetDeps = {},
  ) {
    this.opts = deps.local ?? {
      bnb: process.env.FAUCET_BNB ?? '10',
      usdc: process.env.FAUCET_USDC ?? '10000',
      cooldownMs: Number(process.env.FAUCET_COOLDOWN_SECONDS ?? 30) * 1000,
    };
    this.now = deps.now ?? Date.now;
    this.wallet = deps.wallet ?? ((key) => walletClient(this.cfg, key));
    this.testnet = {
      drip: envNum('TESTNET_FAUCET_BNB', '0.003'),
      dailyCap: envNum('TESTNET_FAUCET_DAILY_BNB', '0.03'),
      enough: envNum('TESTNET_FAUCET_ENOUGH_BNB', '0.01'),
      reserve: envNum('TESTNET_FAUCET_RESERVE_BNB', '0.001'),
      cooldownMs: Number(envNum('TESTNET_FAUCET_COOLDOWN_HOURS', '24')) * 60 * 60 * 1000,
      stateFile: path.join(cfg.dataDir, 'faucet-97.json'),
      ...deps.testnet,
    };
    this.ledger = new LedgerFile(this.testnet.stateFile);
  }

  mode(): 'local' | 'testnet' | 'off' {
    if (isLoopbackRpc(this.cfg.rpcUrl)) return 'local';
    if (this.cfg.chainId === 97) return 'testnet';
    return 'off';
  }

  private testnetKey(): Hex | null {
    const k = process.env.TESTNET_FAUCET_PRIVATE_KEY;
    return k && /^0x[0-9a-fA-F]{64}$/.test(k) ? (k as Hex) : null;
  }

  /** The faucet wallet's address on testnet, or null without a key. */
  testnetAddress(): Address | null {
    const k = this.testnetKey();
    return k ? privateKeyToAccount(k).address : null;
  }

  /** Why the faucet is off, or null when it can pay out. */
  disabledReason(): string | null {
    const m = this.mode();
    if (m === 'off') return `the chain at ${redactUrl(this.cfg.rpcUrl)} is not a local node or BNB testnet; test funds exist only there`;
    if (m === 'local' && !process.env.FAUCET_PRIVATE_KEY) return 'FAUCET_PRIVATE_KEY is not set (scripts/dev-all.sh sets anvil account #0)';
    if (m === 'testnet' && !this.testnetKey()) return 'TESTNET_FAUCET_PRIVATE_KEY is not set on the server; use a public BNB testnet faucet';
    return null;
  }

  private usdcAddress(): Address | undefined {
    return deploymentAddress(this.cfg.deployments, 'demoUsdc');
  }

  /** What the faucet pays and, on testnet, whether `address` (and the caller's IP) can be paid right now. */
  async status(address?: string, ip?: string) {
    const why = this.disabledReason();
    const m = this.mode();
    const base = {
      enabled: why === null,
      reason: why,
      mode: m,
      bnb: m === 'testnet' ? this.testnet.drip : this.opts.bnb,
      usdc: this.usdcAddress() ? (m === 'testnet' ? envNum('TESTNET_FAUCET_USDC', '1000') : this.opts.usdc) : null,
      demoUsdc: this.usdcAddress() ?? null,
      demoUsdcPair: deploymentAddress(this.cfg.deployments, 'demoUsdcPair') ?? null,
      router: deploymentAddress(this.cfg.deployments, 'router') ?? null,
      wbnb: this.cfg.wbnb ?? null,
      label:
        m === 'testnet'
          ? 'BNB testnet drip: a little tBNB for gas and a first commitment. Test BNB has no value.'
          : 'Local test funds: anvil test BNB and Demo USDC on the dev chain. Worthless anywhere else.',
      publicFaucets: PUBLIC_FAUCETS,
    };
    if (m !== 'testnet') return { ...base, testnet: null };
    const faucetAddress = this.testnetAddress();
    let faucetBalance: string | null = null;
    try {
      if (faucetAddress) faucetBalance = formatEther(await this.client.getBalance({ address: faucetAddress }));
    } catch {
      /* RPC hiccup: the balance shows as unknown */
    }
    const l = this.ledger.read(this.now());
    const dailyLeft = parseEther(this.testnet.dailyCap) - BigInt(l.paidWei);
    let eligible: { ok: boolean; reason: string | null; retryAt: number | null } | null = null;
    if (address && isAddress(address)) {
      const a = getAddress(address);
      const block = this.limit(l, a, ip);
      eligible = block ? { ok: false, reason: block.message, retryAt: (block.extra.retryAt as number | undefined) ?? null } : { ok: true, reason: null, retryAt: null };
    }
    const dry = faucetBalance !== null && parseEther(faucetBalance) < parseEther(this.testnet.drip) + parseEther(this.testnet.reserve);
    return {
      ...base,
      enabled: base.enabled && !dry,
      reason: base.reason ?? (dry ? 'The Covenant faucet is out of tBNB for now.' : null),
      testnet: {
        drip: this.testnet.drip,
        dailyCap: this.testnet.dailyCap,
        dailyLeft: formatEther(dailyLeft > 0n ? dailyLeft : 0n),
        cooldownHours: this.testnet.cooldownMs / 3_600_000,
        enough: this.testnet.enough,
        faucetAddress,
        faucetBalance,
        dry,
        eligible,
      },
    };
  }

  /** The first limit that blocks a testnet drip to `a` from `ip`, or null. */
  private limit(l: Ledger, a: Address, ip?: string): FaucetError | null {
    const now = this.now();
    const hours = (t: number) => Math.max(1, Math.ceil((t + this.testnet.cooldownMs - now) / 3_600_000));
    const prevA = l.byAddress[a.toLowerCase()];
    if (prevA !== undefined && now - prevA < this.testnet.cooldownMs) {
      return new FaucetError(429, `This wallet got its tBNB drip already. The next one opens in about ${hours(prevA)} h.`, { retryAt: prevA + this.testnet.cooldownMs, publicFaucets: PUBLIC_FAUCETS });
    }
    const prevIp = ip ? l.byIp[ip] : undefined;
    if (prevIp !== undefined && now - prevIp < this.testnet.cooldownMs) {
      return new FaucetError(429, `A drip already went to another wallet from your network today. The next one opens in about ${hours(prevIp)} h.`, { retryAt: prevIp + this.testnet.cooldownMs, publicFaucets: PUBLIC_FAUCETS });
    }
    if (BigInt(l.paidWei) + parseEther(this.testnet.drip) > parseEther(this.testnet.dailyCap)) {
      const tomorrow = Date.parse(`${l.day}T00:00:00Z`) + DAY_MS;
      return new FaucetError(429, "Today's tBNB from the Covenant faucet is used up. It refills at 00:00 UTC.", { retryAt: tomorrow, publicFaucets: PUBLIC_FAUCETS });
    }
    return null;
  }

  async send(to: string, ip?: string): Promise<FaucetResult> {
    const why = this.disabledReason();
    if (why) throw new FaucetError(403, `faucet off: ${why}`, { publicFaucets: PUBLIC_FAUCETS });
    if (!isAddress(to)) throw new FaucetError(400, 'address must be a 0x address');
    const address = getAddress(to);
    if (this.mode() === 'testnet') {
      // one drip at a time: the ledger check, the reservation and the nonce stay consistent
      const run = this.queue.then(() => this.sendTestnet(address, ip));
      this.queue = run.catch(() => undefined);
      return run;
    }
    // loopback is not proof of a dev chain (a local mainnet node, an SSH tunnel): the node must say it is anvil
    if (!(await isLocalDevNode(this.client))) {
      throw new FaucetError(403, 'faucet off: the loopback RPC is not a local dev node (web3_clientVersion is not anvil)', { publicFaucets: PUBLIC_FAUCETS });
    }
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

  private async sendTestnet(address: Address, ip?: string): Promise<FaucetResult> {
    // the RPC must really be chain 97, whatever CHAIN_ID says
    this.rpcChain ??= this.client.getChainId().catch((e) => { this.rpcChain = null; throw e; });
    const id = await this.rpcChain;
    if (id !== 97) throw new FaucetError(403, `faucet off: the RPC answers chain ${id}, not BNB testnet (97)`);

    const l = this.ledger.read(this.now());
    const blocked = this.limit(l, address, ip);
    if (blocked) throw blocked;

    const drip = parseEther(this.testnet.drip);
    const has = await this.client.getBalance({ address });
    if (has >= parseEther(this.testnet.enough)) {
      throw new FaucetError(409, `This wallet already holds ${Number(formatEther(has)).toFixed(4)} tBNB, enough for gas and a first commitment.`);
    }
    const key = this.testnetKey()!;
    const from = privateKeyToAccount(key).address;
    const bal = await this.client.getBalance({ address: from });
    if (bal < drip + parseEther(this.testnet.reserve)) {
      throw new FaucetError(503, 'The Covenant faucet is out of tBNB for now. The public BNB testnet faucets below pay out in a minute.', { publicFaucets: PUBLIC_FAUCETS });
    }

    // reserve before sending, so a crash mid-send never pays the same wallet twice
    const t = this.now();
    this.ledger.write({ ...l, paidWei: (BigInt(l.paidWei) + drip).toString(), byAddress: { ...l.byAddress, [address.toLowerCase()]: t }, byIp: ip ? { ...l.byIp, [ip]: t } : l.byIp });
    const w = this.wallet(key);
    const account = w.account!;
    let bnbTx: Hex;
    try {
      bnbTx = await w.sendTransaction({ account, chain: w.chain, to: address, value: drip });
    } catch (e) {
      this.ledger.write(l); // nothing was sent: release the reservation
      throw new FaucetError(502, `The drip could not be sent: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}`);
    }
    const rc = await this.client.waitForTransactionReceipt({ hash: bnbTx, timeout: 60_000 });
    if (rc.status !== 'success') throw new FaucetError(502, `The drip reverted (${bnbTx}).`);

    // Demo USDC only where chain 97 records one and this wallet may mint it
    const usdc = this.usdcAddress();
    let usdcTx: Hex | null = null;
    let usdcAmount: string | null = null;
    if (usdc) {
      try {
        const minter = await this.client.readContract({ address: usdc, abi: MINTER_ABI, functionName: 'minter' });
        if (minter.toLowerCase() === from.toLowerCase()) {
          usdcAmount = envNum('TESTNET_FAUCET_USDC', '1000');
          usdcTx = await w.writeContract({ account, chain: w.chain, address: usdc, abi: MINT_ABI, functionName: 'mint', args: [address, parseUnits(usdcAmount, 6)] });
          await this.client.waitForTransactionReceipt({ hash: usdcTx, timeout: 60_000 });
        }
      } catch {
        usdcTx = null;
        usdcAmount = null;
      }
    }
    return { address, bnbWei: drip.toString(), bnbTx, usdc: usdcAmount, usdcTx, label: 'BNB testnet drip' };
  }
}
