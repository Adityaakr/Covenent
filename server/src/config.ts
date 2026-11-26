import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { getAddress, isAddress, type Address, type Hex } from 'viem';

const here = path.dirname(fileURLToPath(import.meta.url));
/** server/ */
export const SERVER_ROOT = path.resolve(here, '..');
/** repository root (server/..) */
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

loadDotenv({ path: path.join(SERVER_ROOT, '.env'), quiet: true });

/** Shape written by contracts/ dev script: contracts/deployments/local.json */
export interface Deployments {
  chainId: number;
  rpcUrl: string;
  startBlock?: number;
  /** written by contracts' DevDeploy: first block of the stack (on a fork, reading logs below it hits the upstream RPC) */
  deployedAtBlock?: number;
  addresses: Record<string, unknown>;
  demo?: Record<string, unknown>;
}

export interface CovenantRef {
  vault: Address;
  launcher?: Address;
  token?: Address;
  pair?: Address;
  name?: string;
}

/**
 * Anvil's well-known account #9. Public test key, used only as the *local* Atlas test signer when
 * no Atlas API key is configured. Never fund it on a public network.
 */
export const LOCAL_TEST_SIGNER_KEY: Hex =
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v.trim() === '' ? undefined : v.trim();
}

export function deploymentsPath(): string {
  return env('COVENANT_DEPLOYMENTS') ?? path.join(REPO_ROOT, 'contracts', 'deployments', 'local.json');
}

export function abiDir(): string {
  return env('COVENANT_ABI_DIR') ?? path.join(REPO_ROOT, 'contracts', 'abi');
}

export function loadDeployments(file = deploymentsPath()): Deployments | null {
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Deployments;
  return raw;
}

const SKIP_KEY = /factory|implementation|impl$|beacon|registry|portal|router|guardian|template/i;

/**
 * Walk the deployments JSON and pull out covenant vaults (and their launcher, token, pair when
 * they sit beside the vault in the same object). Accepts `vault`, `covenantVault`, `vaults: []`,
 * `covenants: [{vault, launcher}]` and similar shapes so the contracts' dev script is free to
 * choose its layout.
 */
export function covenantsFromDeployments(d: Deployments | null): CovenantRef[] {
  if (!d) return [];
  const out = new Map<string, CovenantRef>();
  const addr = (v: unknown): Address | undefined =>
    typeof v === 'string' && isAddress(v) ? getAddress(v) : undefined;

  const visit = (node: unknown, keyHint: string) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (/vaults?$/i.test(keyHint) && addr(item)) add({ vault: addr(item)! });
        else visit(item, keyHint);
      }
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const vaultKey = Object.keys(obj).find((k) => /vault$/i.test(k) && !SKIP_KEY.test(k) && addr(obj[k]));
    if (vaultKey) {
      add({
        vault: addr(obj[vaultKey])!,
        launcher: addr(obj[Object.keys(obj).find((k) => /launcher$/i.test(k) && !SKIP_KEY.test(k)) ?? '']),
        token: addr(obj.token),
        pair: addr(obj.pair ?? obj.pool),
        name: typeof obj.name === 'string' ? obj.name : undefined,
      });
    }
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') visit(v, k);
    }
  };
  const add = (c: CovenantRef) => {
    const prev = out.get(c.vault.toLowerCase());
    out.set(c.vault.toLowerCase(), { ...prev, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v)) } as CovenantRef);
  };
  visit(d.addresses, 'addresses');
  visit(d.demo, 'demo');
  return [...out.values()];
}

/** Find a named address anywhere in deployments.addresses (case-insensitive key match). */
export function deploymentAddress(d: Deployments | null, ...keys: string[]): Address | undefined {
  if (!d) return undefined;
  const wanted = keys.map((k) => k.toLowerCase());
  let found: Address | undefined;
  const visit = (node: unknown) => {
    if (found || !node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === 'string' && isAddress(v) && wanted.includes(k.toLowerCase())) {
        found = getAddress(v);
        return;
      }
      if (v && typeof v === 'object') visit(v);
    }
  };
  visit(d.addresses);
  if (!found) visit(d.demo);
  return found;
}

export interface ServerConfig {
  rpcUrl: string;
  chainId: number;
  deployments: Deployments | null;
  covenants: CovenantRef[];
  oracle?: Address;
  wbnb?: Address;
  identityRegistry?: Address;
  reputationRegistry?: Address;
  covenantVaultFactory?: Address;
  /** CovenantLens, when deployed */
  lens?: Address;
  /** launcher factories whose launchers are covenants (discovered on every list) */
  launcherFactories: Address[];
  startBlock: bigint;
  apiPort: number;
  apiBaseUrl: string;
  corsOrigins: string[];
  atlas: {
    apiKey?: string;
    bnbUsdFeedId: string;
    localSignerKey: Hex;
    localBnbUsd: string;
    pushFeed?: Address;
    localSignerAllowed: boolean;
  };
  cmc: { apiKey?: string; baseUrl: string };
  anthropic: { apiKey?: string; model: string };
  keeper: {
    privateKey?: Hex;
    tickSeconds: number;
    pokeIntervalSeconds: number;
    dispatchTax: boolean;
    stateFile: string;
    alertWebhook?: string;
    alertsFile: string;
  };
  dataDir: string;
  simulatorFile: string;
}

function parseCovenantEnv(v: string | undefined): CovenantRef[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [vault, launcher] = entry.split(':');
      return { vault: getAddress(vault!), launcher: launcher ? getAddress(launcher) : undefined };
    });
}

/**
 * First block worth reading logs from. On a fork, deployedAtBlock is the fork block itself; any log range that
 * touches it or anything below makes anvil ask the upstream public RPC, which rate-limits, so start one above.
 */
function firstLocalBlock(d: Deployments | null): number {
  if (!d?.deployedAtBlock) return 0;
  return (d as { mode?: string }).mode === 'fork' ? d.deployedAtBlock + 1 : d.deployedAtBlock;
}

/** Atlas BNB/USD push feed on BNB testnet, verified 2026-11-26 (contracts/config/atlas-97.json). */
export const TESTNET_ATLAS_PUSH_BNB_USD = getAddress('0x3957d289ee9C38272377786787ea34F9dd29788D');

function chainIdFor(d: Deployments | null): number {
  return Number(env('CHAIN_ID') ?? d?.chainId ?? 31337);
}

export function loadConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const deployments = overrides.deployments !== undefined ? overrides.deployments : loadDeployments();
  const fromEnv = parseCovenantEnv(env('COVENANT_VAULTS'));
  const fromDeploy = covenantsFromDeployments(deployments);
  const merged = new Map<string, CovenantRef>();
  for (const c of [...fromDeploy, ...fromEnv]) merged.set(c.vault.toLowerCase(), { ...merged.get(c.vault.toLowerCase()), ...c });

  const dataDir = env('COVENANT_DATA_DIR') ?? path.join(SERVER_ROOT, '.data');
  const apiPort = Number(env('API_PORT') ?? 8787);
  const addrEnv = (name: string) => {
    const v = env(name);
    return v && isAddress(v) ? getAddress(v) : undefined;
  };

  const cfg: ServerConfig = {
    rpcUrl: env('RPC_URL') ?? deployments?.rpcUrl ?? 'http://127.0.0.1:8545',
    chainId: Number(env('CHAIN_ID') ?? deployments?.chainId ?? 31337),
    deployments,
    covenants: [...merged.values()],
    oracle: addrEnv('COVENANT_ORACLE') ?? deploymentAddress(deployments, 'oracle', 'covenantOracle', 'CovenantOracle'),
    wbnb: addrEnv('WBNB') ?? deploymentAddress(deployments, 'wbnb', 'WBNB', 'weth', 'quote'),
    identityRegistry:
      addrEnv('ERC8004_IDENTITY') ?? deploymentAddress(deployments, 'identityRegistry', 'IdentityRegistry', 'erc8004Identity'),
    reputationRegistry:
      addrEnv('ERC8004_REPUTATION') ??
      deploymentAddress(deployments, 'reputationRegistry', 'ReputationRegistry', 'erc8004Reputation'),
    lens: addrEnv('COVENANT_LENS') ?? deploymentAddress(deployments, 'lens', 'CovenantLens'),
    launcherFactories: [
      ...new Set(
        [deploymentAddress(deployments, 'launcherFactory'), deploymentAddress(deployments, 'demoLauncherFactory')].filter(
          (a): a is Address => !!a,
        ),
      ),
    ],
    covenantVaultFactory: addrEnv('COVENANT_VAULT_FACTORY') ?? deploymentAddress(deployments, 'vaultFactory', 'CovenantVaultFactory'),
    startBlock: BigInt(env('START_BLOCK') ?? deployments?.startBlock ?? firstLocalBlock(deployments)),
    apiPort,
    apiBaseUrl: env('API_BASE_URL') ?? `http://127.0.0.1:${apiPort}`,
    corsOrigins: (env('CORS_ORIGINS') ?? 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080').split(',').map((s) => s.trim()),
    atlas: {
      apiKey: env('ATLAS_API_KEY'),
      bnbUsdFeedId: env('ATLAS_BNB_USD_FEED_ID') ?? String(deployments?.demo?.atlasBnbUsdFeedId ?? '1'),
      localSignerKey: (env('ATLAS_LOCAL_SIGNER_KEY') as Hex | undefined) ?? LOCAL_TEST_SIGNER_KEY,
      localBnbUsd: env('ATLAS_LOCAL_BNB_USD') ?? '600',
      // BNB testnet has an Atlas BNB/USD push feed (contracts/config/atlas-97.json); there the oracle reads it and
      // the local test signer, which no real oracle accepts, is never used.
      pushFeed: addrEnv('ATLAS_PUSH_FEED') ?? (chainIdFor(deployments) === 97 ? TESTNET_ATLAS_PUSH_BNB_USD : undefined),
      localSignerAllowed: chainIdFor(deployments) !== 97,
    },
    cmc: { apiKey: env('CMC_API_KEY'), baseUrl: env('CMC_BASE_URL') ?? 'https://pro-api.coinmarketcap.com' },
    anthropic: { apiKey: env('ANTHROPIC_API_KEY'), model: env('ANTHROPIC_MODEL') ?? 'claude-opus-5-5' },
    keeper: {
      privateKey: env('KEEPER_PRIVATE_KEY') as Hex | undefined,
      tickSeconds: Number(env('KEEPER_TICK_SECONDS') ?? 60),
      pokeIntervalSeconds: Number(env('KEEPER_POKE_INTERVAL_SECONDS') ?? 3600),
      dispatchTax: (env('KEEPER_DISPATCH_TAX') ?? 'true') !== 'false',
      stateFile: env('KEEPER_STATE_FILE') ?? path.join(dataDir, 'keeper-state.json'),
      alertWebhook: env('ALERT_WEBHOOK_URL'),
      alertsFile: env('ALERTS_FILE') ?? path.join(dataDir, 'alerts.jsonl'),
    },
    dataDir,
    simulatorFile: env('SIMULATOR_FILE') ?? path.join(SERVER_ROOT, 'data', 'simulator', 'latest.json'),
    ...overrides,
  };
  return cfg;
}
