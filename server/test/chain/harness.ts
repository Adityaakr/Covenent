import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  parseEther,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { LOCAL_TEST_SIGNER_KEY, loadConfig, type Deployments, type ServerConfig } from '../../src/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// The fixture chain deploys the doc-shaped stand-ins in test/fixtures/contracts, not the real contracts, so their
// tests read the doc's ABI (src/abi/fallback.ts) rather than contracts/abi; deployed.test.ts covers the real ones.
process.env.COVENANT_ABI_DIR = path.join(here, 'no-published-abi');
const FIXTURE = path.resolve(here, '../fixtures/contracts');
const FOUNDRY_BIN = path.join(process.env.HOME ?? '', '.foundry', 'bin');

/** anvil's default mnemonic accounts (public test keys) */
export const KEYS = {
  deployer: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  team: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  buyer1: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  buyer2: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  buyer3: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  keeper: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  whale: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
} as const satisfies Record<string, Hex>;

export const addr = (k: Hex) => privateKeyToAccount(k).address;

const SOURCE_OF: Record<string, string> = { MockIdentityRegistry: 'MockErc8004', MockReputationRegistry: 'MockErc8004' };

function artifact(name: string): { abi: Abi; bytecode: Hex } {
  const file = SOURCE_OF[name] ?? name;
  const j = JSON.parse(readFileSync(path.join(FIXTURE, 'out', `${file}.sol`, `${name}.json`), 'utf8'));
  return { abi: j.abi as Abi, bytecode: j.bytecode.object as Hex };
}

let built = false;
export function buildFixtures(): void {
  if (built) return;
  execFileSync(path.join(FOUNDRY_BIN, 'forge'), ['build', '--root', FIXTURE], { stdio: 'pipe' });
  built = true;
}

export interface Anvil {
  rpcUrl: string;
  proc: ChildProcess;
  /** Kills anvil and runs the cleanups registered with `onStop` (the fixture's temp data dir). */
  stop(): void;
  onStop(fn: () => void): void;
}

export async function startAnvil(): Promise<Anvil> {
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const proc = spawn(path.join(FOUNDRY_BIN, 'anvil'), ['--port', String(port), '--silent'], { stdio: 'ignore' });
  const rpcUrl = `http://127.0.0.1:${port}`;
  const c = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  for (let i = 0; i < 100; i++) {
    try {
      await c.getChainId();
      const cleanups: (() => void)[] = [];
      return {
        rpcUrl,
        proc,
        stop: () => {
          proc.kill('SIGKILL');
          for (const fn of cleanups.splice(0)) fn();
        },
        onStop: (fn) => cleanups.push(fn),
      };
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  proc.kill('SIGKILL');
  throw new Error('anvil did not start');
}

export const E18 = 10n ** 18n;
export const SUPPLY = 1_000_000_000n * E18;
export const SALE = 600_000_000n * E18;
export const POOL = 150_000_000n * E18;
export const TEAM = 250_000_000n * E18;
export const FEED: Hex = '0x00000001';

export interface Fixture {
  rpcUrl: string;
  client: PublicClient;
  test: ReturnType<typeof createTestClient>;
  deployments: Deployments;
  deploymentsFile: string;
  dataDir: string;
  token: Address;
  wbnb: Address;
  pair: Address;
  oracle: Address;
  launcher: Address;
  vault: Address;
  abis: Record<'token' | 'pair' | 'oracle' | 'launcher' | 'vault', Abi>;
  cfg(extra?: Partial<ServerConfig>): ServerConfig;
  write(key: Hex, to: Address, abi: Abi, fn: string, args?: unknown[], value?: bigint): Promise<Hex>;
  setPrice(tokenReserve: bigint, bnbReserve: bigint): Promise<void>;
  warp(seconds: number): Promise<void>;
}

/**
 * Deploy a covenant shaped like docs/DESIGN.md's worked example (500 BNB accepted, 125 BNB pool
 * seed + 150M tokens, 375 BNB treasury, 1B supply split 60/15/25) with the demo factory timers
 * (exit streak 3 min, round 5 min, cooldown 2 min, heartbeat 10 min, poke interval 20 s).
 */
export async function deployFixture(anvil: Anvil, opts: { identity?: boolean } = {}): Promise<Fixture> {
  buildFixtures();
  const rpcUrl = anvil.rpcUrl;
  const client = createPublicClient({ chain: foundry, transport: http(rpcUrl) }) as PublicClient;
  const test = createTestClient({ chain: foundry, mode: 'anvil', transport: http(rpcUrl) });
  const wallet = (k: Hex) => createWalletClient({ account: privateKeyToAccount(k), chain: foundry, transport: http(rpcUrl) });

  const deploy = async (name: string, args: unknown[]) => {
    const { abi, bytecode } = artifact(name);
    const hash = await wallet(KEYS.deployer).deployContract({ abi, bytecode, args });
    const r = await client.waitForTransactionReceipt({ hash });
    return { address: r.contractAddress!, abi };
  };
  const write = async (key: Hex, to: Address, abi: Abi, fn: string, args: unknown[] = [], value = 0n) => {
    const hash = await wallet(key).writeContract({ address: to, abi, functionName: fn, args, value, chain: foundry, account: privateKeyToAccount(key) });
    const r = await client.waitForTransactionReceipt({ hash });
    if (r.status !== 'success') throw new Error(`${fn} reverted`);
    return hash;
  };

  const deployer = addr(KEYS.deployer);
  const token = await deploy('MockToken', ['Covenant Demo', 'CVD', SUPPLY, deployer]);
  const wbnb = await deploy('MockToken', ['Wrapped BNB', 'WBNB', 1_000_000n * E18, deployer]);
  const pair = await deploy('MockPair', [token.address, wbnb.address]);
  const oracle = await deploy('MockCovenantOracle', [FEED, privateKeyToAccount(LOCAL_TEST_SIGNER_KEY).address, 20n]);
  const launcher = await deploy('MockCovenantLauncher', [200n * E18, 500n * E18, 120n, SALE]);
  const salePrice = (500n * E18 * E18) / SALE;
  // optional ERC-8004 registries: the team registers as an agent before the vault binds its id
  let identity: Address | undefined;
  let reputation: Address | undefined;
  let agentId = 0n;
  if (opts.identity) {
    const idr = await deploy('MockIdentityRegistry', []);
    const rep = await deploy('MockReputationRegistry', [idr.address]);
    identity = idr.address;
    reputation = rep.address;
    await write(KEYS.team, idr.address, idr.abi, 'register', ['http://127.0.0.1:8787/agents/team/registration.json']);
    agentId = 1n;
  }
  const vault = await deploy('MockCovenantVault', [
    {
      token: token.address,
      launcher: launcher.address,
      oracle: oracle.address,
      teamWallet: addr(KEYS.team),
      pair: pair.address,
      agentId,
      salePriceBnb: salePrice,
      tapUsdPer30d: 30_000n * E18,
      tapCapBps: 400,
      exitStreak: 180,
      roundLength: 300,
      cooldown: 120,
      exitFeeBps: 100,
      heartbeat: 600,
      unlockWindow: 120,
      lockedTeam: TEAM,
    },
    [200, 400, 800],
    [50_000_000n * E18, 100_000_000n * E18, 100_000_000n * E18],
  ]);

  const t = token.abi;
  await write(KEYS.deployer, token.address, t, 'transfer', [vault.address, TEAM]);
  await write(KEYS.deployer, token.address, t, 'transfer', [pair.address, POOL]);
  for (const b of [KEYS.buyer1, KEYS.buyer2, KEYS.buyer3]) await write(KEYS.deployer, token.address, t, 'transfer', [addr(b), SALE / 3n]);
  await write(KEYS.deployer, vault.address, vault.abi, 'fundTreasury', [pair.address], 375n * E18);
  await write(KEYS.deployer, oracle.address, oracle.abi, 'register', [vault.address, pair.address, wbnb.address, 125n * E18]);
  await write(KEYS.deployer, launcher.address, launcher.abi, 'setLaunched', [token.address, vault.address]);

  const setPrice = async (tokenReserve: bigint, bnbReserve: bigint) => {
    const tokenIs0 = token.address.toLowerCase() < wbnb.address.toLowerCase();
    await write(KEYS.deployer, pair.address, pair.abi, 'setReserves', tokenIs0 ? [tokenReserve, bnbReserve] : [bnbReserve, tokenReserve]);
  };
  await setPrice(POOL, 125n * E18);

  const startBlock = Number(await client.getBlockNumber());
  const deployments: Deployments = {
    chainId: 31337,
    rpcUrl,
    startBlock: 0,
    addresses: { oracle: oracle.address, wbnb: wbnb.address, ...(identity ? { identityRegistry: identity, reputationRegistry: reputation } : {}) },
    demo: {
      name: 'Covenant Demo',
      vault: vault.address,
      launcher: launcher.address,
      token: token.address,
      pair: pair.address,
      team: addr(KEYS.team),
      atlasBnbUsdFeedId: '1',
      deployedAtBlock: startBlock,
    },
  };
  const dataDir = mkdtempSync(path.join(tmpdir(), 'covenant-server-test-'));
  anvil.onStop(() => rmSync(dataDir, { recursive: true, force: true }));
  const deploymentsFile = path.join(dataDir, 'local.json');
  writeFileSync(deploymentsFile, JSON.stringify(deployments, null, 2));

  return {
    rpcUrl,
    client,
    test,
    deployments,
    deploymentsFile,
    dataDir,
    token: token.address,
    wbnb: wbnb.address,
    pair: pair.address,
    oracle: oracle.address,
    launcher: launcher.address,
    vault: vault.address,
    abis: { token: token.abi, pair: pair.abi, oracle: oracle.abi, launcher: launcher.abi, vault: vault.abi },
    cfg: (extra = {}) => {
      const base = loadConfig({ deployments });
      return {
        ...base,
        rpcUrl,
        chainId: 31337,
        dataDir,
        atlas: { ...base.atlas, apiKey: undefined, bnbUsdFeedId: '1', localSignerKey: LOCAL_TEST_SIGNER_KEY, localBnbUsd: '600' },
        keeper: {
          ...base.keeper,
          privateKey: KEYS.keeper,
          pokeIntervalSeconds: 20,
          tickSeconds: 1,
          stateFile: path.join(dataDir, 'keeper-state.json'),
          alertsFile: path.join(dataDir, 'alerts.jsonl'),
          alertWebhook: undefined,
        },
        cmc: { ...base.cmc, apiKey: undefined },
        anthropic: { ...base.anthropic, apiKey: undefined },
        ...extra,
      };
    },
    write,
    setPrice,
    warp: async (seconds: number) => {
      await test.increaseTime({ seconds });
      await test.mine({ blocks: 1 });
    },
  };
}

export { parseEther };
