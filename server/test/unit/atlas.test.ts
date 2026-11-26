import { describe, expect, it } from 'vitest';
import { PullOracleConsumerClient } from '@atlas-oracle/pull-oracle-consumer-sdk';
import { hexToBytes, keccak256, slice } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { oracleAbi } from '../../src/abi/fallback.js';
import { encodePackages, fetchBnbUsdReport, parseReport, pokeCalldata, signReport, stripReport } from '../../src/atlas/report.js';
import { LOCAL_TEST_SIGNER_KEY } from '../../src/config.js';

const VAULT = '0x1111111111111111111111111111111111111111';
const signer = privateKeyToAccount(LOCAL_TEST_SIGNER_KEY).address;

describe('Atlas pull report codec', () => {
  it('lays out packages as feedId u32 | value u80 | ts u48, then count, signature, 0x7096', async () => {
    const feeds = [{ feedId: '1', price: '612.5', timestamp: 1_795_000_000 }];
    const xd = await signReport(feeds, LOCAL_TEST_SIGNER_KEY);
    const b = hexToBytes(xd);
    expect(b.length).toBe(20 + 1 + 65 + 2);
    expect(slice(xd, 0, 4)).toBe('0x00000001');
    expect(BigInt(slice(xd, 4, 14))).toBe(612_500_000_000_000_000_000n);
    expect(BigInt(slice(xd, 14, 20))).toBe(1_795_000_000n);
    expect(b[20]).toBe(1);
    expect(slice(xd, b.length - 2)).toBe('0x7096');
    const v = b[20 + 1 + 64]!;
    expect([27, 28]).toContain(v);
    // low-s (EIP-2), which the consumer enforces
    const s = BigInt(slice(xd, 21 + 32, 21 + 64));
    expect(s <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n).toBe(true);
  });

  it('signs keccak256(packages ++ count) with no EIP-191 prefix and round-trips', async () => {
    const feeds = [
      { feedId: '1', price: '600', timestamp: 1_795_000_000 },
      { feedId: '3323', price: '0.000000833', timestamp: 1_795_000_001 },
    ];
    const xd = await signReport(feeds, LOCAL_TEST_SIGNER_KEY);
    const parsed = await parseReport(xd);
    expect(parsed.signer).toBe(signer);
    expect(parsed.signedHash).toBe(keccak256(encodePackages(feeds)));
    expect(parsed.packages).toEqual(feeds);
  });

  it('rejects a wrong magic marker', async () => {
    const xd = await signReport([{ feedId: '1', price: '600', timestamp: 1 }], LOCAL_TEST_SIGNER_KEY);
    await expect(parseReport(`${xd.slice(0, -4)}7097` as `0x${string}`)).rejects.toThrow(/magic/);
  });

  it('builds poke calldata exactly as the Atlas SDK does (encode call, append extraData)', async () => {
    const xd = await signReport([{ feedId: '1', price: '600', timestamp: 1_795_000_000 }], LOCAL_TEST_SIGNER_KEY);
    const sdk = new PullOracleConsumerClient({ http: { apiKey: 'unused' }, validate: false });
    const fromSdk = sdk.buildCalldata({ abi: oracleAbi, functionName: 'poke', args: [VAULT], extraData: xd });
    const ours = pokeCalldata(oracleAbi, VAULT, xd);
    expect(ours).toBe(fromSdk);
    expect(stripReport(ours, xd)).toBe(pokeCalldata(oracleAbi, VAULT));
  });

  it('local mode labels itself and uses the fixed test price', async () => {
    const r = await fetchBnbUsdReport({ bnbUsdFeedId: '1', localSignerKey: LOCAL_TEST_SIGNER_KEY, localBnbUsd: '600' });
    expect(r.mode).toBe('local-test-signer');
    expect(r.note).toMatch(/LOCAL TEST SIGNER/);
    expect(r.signer).toBe(signer);
    expect(Math.abs(r.timestamp - Date.now() / 1000)).toBeLessThan(5);
  });
});
