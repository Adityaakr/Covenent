import { describe, expect, it } from 'vitest';
import { covenantsFromDeployments, deploymentAddress } from '../../src/config.js';
import { mergeAbi } from '../../src/abi/index.js';
import { vaultAbi } from '../../src/abi/fallback.js';
import { bookValue, exitEta, floorAfter, redeemOut, sellQuote, settle, startingFloor, WAD } from '../../src/covenant/math.js';
import { parseAbi } from 'viem';

const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const C = '0x00000000000000000000000000000000000000c3';

describe('deployments discovery', () => {
  it('finds vaults in several layouts and skips factories', () => {
    const refs = covenantsFromDeployments({
      chainId: 31337,
      rpcUrl: 'http://x',
      addresses: { vaultFactory: A, CovenantOracle: B, covenants: [{ vault: C, launcher: A, name: 'X' }] },
      demo: { covenantVault: B, covenantLauncher: C },
    });
    expect(refs.map((r) => r.vault.toLowerCase()).sort()).toEqual([B, C].sort());
    expect(refs.find((r) => r.vault.toLowerCase() === C)!.launcher!.toLowerCase()).toBe(A);
  });
  it('finds named addresses case-insensitively', () => {
    const d = { chainId: 1, rpcUrl: '', addresses: { nested: { CovenantOracle: B } } };
    expect(deploymentAddress(d, 'covenantOracle')!.toLowerCase()).toBe(B);
  });
  it('published ABI entries win over fallback ones by name', () => {
    const pub = parseAbi(['function exitStreak() view returns (uint64)']);
    const m = mergeAbi(pub, vaultAbi);
    const fns = m.filter((i) => i.type === 'function' && i.name === 'exitStreak');
    expect(fns).toHaveLength(1);
    expect((fns[0] as unknown as { outputs: { type: string }[] }).outputs[0]!.type).toBe('uint64');
  });
});

describe('covenant math (docs/DESIGN.md)', () => {
  it('worked example: 375 BNB over 750M redeemable is 60% of the 500/600M sale price', () => {
    const b = bookValue(375n * WAD, 0n, 750_000_000n * WAD);
    const sale = (500n * WAD * WAD) / (600_000_000n * WAD);
    expect(Number(b) / Number(sale)).toBeCloseTo(0.6, 9);
    expect(startingFloor(6000, 1500)).toBeCloseTo(0.6);
    expect(startingFloor(7000, 1000)).toBeCloseTo(0.75);
  });
  it('tap-cap floor path matches the doc table (47.0%, 36.8%, 22.5%)', () => {
    expect(floorAfter(0.6, 400, 6)).toBeCloseTo(0.47, 2);
    expect(floorAfter(0.6, 400, 12)).toBeCloseTo(0.368, 3);
    expect(floorAfter(0.6, 400, 24)).toBeCloseTo(0.225, 3);
  });
  it('redemption example: 6M tokens at b = 320/750M pay 2.534 BNB after the 1% fee', () => {
    const b = bookValue(320n * WAD, 0n, 750_000_000n * WAD);
    const out = redeemOut(6_000_000n * WAD, b, 100, false);
    expect(Number(out) / 1e18).toBeCloseTo(2.534, 3);
    expect(redeemOut(6_000_000n * WAD, b, 100, true)).toBeGreaterThan(out);
  });
  it('raise settlement: 14 of 1,400 committed against a 500 cap keeps 5 BNB, refunds 9, gets 6M tokens', () => {
    const r = settle(14n * WAD, 1_400n * WAD, 500n * WAD, 600_000_000n * WAD);
    expect(r.accepted).toBe(5n * WAD);
    expect(r.refund).toBe(9n * WAD);
    expect(r.tokens).toBe(6_000_000n * WAD);
  });
  it('sell quote is below spot and the exit eta follows the decaying streak', () => {
    const q = sellQuote(6_000_000n * WAD, 150_000_000n * WAD, 125n * WAD);
    expect(q).toBeLessThan((6_000_000n * WAD * 125n) / 150_000_000n);
    expect(exitEta(100, 180, true)).toBe(80);
    expect(exitEta(100, 180, false)).toBeNull();
  });
});
