/**
 * Regression (AI-judge audit, 27 Nov 2026): the first BNB testnet covenant, CVT, is named in 97.json as
 * `legacyCovenantVault` / `legacyCovenantLauncher` and sits outside the current factories. The MCP answered
 * get_events with `token: null, pair: null, total: 0` and refused its token address, because (1) a covenant from the
 * record never learned its token and pool, and (2) its logs were read from publicnode, which drops logs older than a
 * few hours. Offline: the chain is a stub, the deployment record is the committed one.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getAddress, type Address, type PublicClient } from 'viem';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, normalizeDeployments, REPO_ROOT, TESTNET_LOG_RPC, TESTNET_START_BLOCK } from '../../src/config.js';
import { CovenantService } from '../../src/covenant/read.js';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
const record = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'deployments', '97.json'), 'utf8')) as Record<string, string>;
const VAULT = getAddress(record.legacyCovenantVault!);
const LAUNCHER = getAddress(record.legacyCovenantLauncher!);
// stand-in token and pool for the stub chain (the real ones are read from the launcher)
const TOKEN = getAddress('0x' + '11'.repeat(18) + '7777');
const POOL = getAddress('0x' + '22'.repeat(20));

function testnetConfig() {
  for (const k of ['RPC_URL', 'LOG_RPC_URL', 'CHAIN_ID', 'COVENANT_DEPLOYMENTS', 'COVENANT_VAULTS']) delete process.env[k];
  return loadConfig({ deployments: normalizeDeployments(record) });
}

/** A chain whose factories list nothing and whose legacy launcher answers token() and pool(). */
function stubChain() {
  const calls: string[] = [];
  const client = {
    readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
      calls.push(`${functionName}@${address}`);
      if (getAddress(address) === LAUNCHER && functionName === 'token') return TOKEN;
      if (getAddress(address) === LAUNCHER && functionName === 'pool') return POOL;
      throw new Error('not on the stub chain');
    },
    getLogs: async () => {
      calls.push('getLogs@client');
      return [];
    },
    getBlockNumber: async () => 0n,
  } as unknown as PublicClient;
  const logs: string[] = [];
  const logClient = {
    getBlockNumber: async () => BigInt(TESTNET_START_BLOCK + 100),
    getLogs: async ({ address, fromBlock }: { address: Address; fromBlock: bigint }) => {
      logs.push(`${address}:${fromBlock}`);
      return [];
    },
  } as unknown as PublicClient;
  return { client, logClient, calls, logs };
}

describe('the legacy CVT covenant in 97.json', () => {
  it('is in the config with its launcher, and testnet logs come from the full-history RPC', () => {
    const cfg = testnetConfig();
    expect(cfg.covenants).toContainEqual(expect.objectContaining({ vault: VAULT, launcher: LAUNCHER }));
    expect(cfg.logRpcUrl).toBe(TESTNET_LOG_RPC);
    expect(cfg.logRpcUrl).not.toBe(cfg.rpcUrl);
  });

  it('a loopback node serves its own logs; LOG_RPC_URL overrides', () => {
    process.env.RPC_URL = 'http://127.0.0.1:8545';
    expect(loadConfig({ deployments: normalizeDeployments(record) }).logRpcUrl).toBeUndefined();
    process.env.LOG_RPC_URL = 'https://logs.example.invalid';
    expect(loadConfig({ deployments: normalizeDeployments(record) }).logRpcUrl).toBe('https://logs.example.invalid');
  });

  it('resolves from its token and pool addresses, and reports them for the vault', async () => {
    const { client, logClient } = stubChain();
    const svc = new CovenantService({ cfg: testnetConfig(), client, logClient });
    const byToken = await svc.resolve(TOKEN);
    expect(byToken).toEqual({ vault: VAULT, launcher: LAUNCHER, token: TOKEN, pair: POOL, matchedAs: 'token' });
    expect((await svc.resolve(POOL)).matchedAs).toBe('pool');
    const fresh = new CovenantService({ cfg: testnetConfig(), client, logClient });
    expect(await fresh.resolve(VAULT)).toEqual({ vault: VAULT, launcher: LAUNCHER, token: TOKEN, pair: POOL, matchedAs: 'vault' });
  });

  it('reads its ledger through the log client, from the deployment start block', async () => {
    const { client, logClient, calls, logs } = stubChain();
    const cfg = testnetConfig();
    const svc = new CovenantService({ cfg, client, logClient });
    await svc.syncEvents({ vault: VAULT, launcher: LAUNCHER });
    expect(calls).not.toContain('getLogs@client');
    expect(logs).toContain(`${VAULT}:${cfg.startBlock}`);
    expect(logs).toContain(`${LAUNCHER}:${cfg.startBlock}`);
  });
});
