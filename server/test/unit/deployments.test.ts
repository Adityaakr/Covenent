import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deploymentFile, deploymentsPath, loadConfig, loadDeployments, normalizeDeployments, REPO_ROOT, TESTNET_PUBLIC_RPC, TESTNET_START_BLOCK } from '../../src/config.js';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});
const record = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'deployments', '97.json'), 'utf8')) as Record<string, string | number>;

describe('the committed BNB testnet record works as is', () => {
  it('lifts the flat Deploy.s.sol record into the app shape', () => {
    const d = normalizeDeployments(record);
    expect(d.chainId).toBe(97);
    expect(d.rpcUrl).toBe(TESTNET_PUBLIC_RPC);
    expect(d.startBlock).toBe(TESTNET_START_BLOCK);
    expect(d.addresses.oracle).toBe(record.oracle);
    expect(d.addresses.chainId).toBeUndefined();
    expect(d.addresses.atlasFeedIdBnbUsd).toBeUndefined(); // a feed id, not an address
  });
  it('leaves an app-shaped record alone', () => {
    const app = { chainId: 31337, rpcUrl: 'http://127.0.0.1:8545', addresses: { oracle: record.oracle } };
    expect(normalizeDeployments(app)).toBe(app);
  });
  it('COVENANT_NETWORK=testnet reads 97.json and finds the factories, oracle, lens and registries', () => {
    delete process.env.COVENANT_DEPLOYMENTS;
    for (const k of ['RPC_URL', 'CHAIN_ID', 'START_BLOCK', 'COVENANT_ORACLE', 'COVENANT_LENS', 'ERC8004_IDENTITY', 'ERC8004_REPUTATION', 'ATLAS_PUSH_FEED']) delete process.env[k];
    process.env.COVENANT_NETWORK = 'testnet';
    expect(deploymentsPath()).toBe(deploymentFile('97.json'));
    const cfg = loadConfig({ deployments: loadDeployments() });
    expect(cfg.chainId).toBe(97);
    expect(cfg.rpcUrl).toBe(TESTNET_PUBLIC_RPC);
    expect(cfg.startBlock).toBe(BigInt(TESTNET_START_BLOCK));
    expect(cfg.oracle).toBe(record.oracle);
    expect(cfg.lens).toBe(record.lens);
    expect(cfg.identityRegistry).toBe(record.identityRegistry);
    // the current pair, then Covenant's own earlier ones (the first testnet covenant was made by `previous*`)
    expect(cfg.launcherFactories).toEqual(
      [
        record.launcherFactory,
        record.demoLauncherFactory,
        record.previousLauncherFactory,
        record.previousDemoLauncherFactory,
        record.round1LauncherFactory,
        record.round1DemoLauncherFactory,
      ].filter(Boolean),
    );
    expect(cfg.atlas.pushFeed).toBeTruthy();
    expect(cfg.atlas.localSignerAllowed).toBe(false);
  });
});
