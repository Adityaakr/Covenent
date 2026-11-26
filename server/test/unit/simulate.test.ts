import { describe, expect, it } from 'vitest';
import { BaseError, encodeErrorResult, parseAbi, RawContractError, type PublicClient } from 'viem';
import { errorAbi, simulate } from '../../src/covenant/simulate.js';

const abi = parseAbi(['error NotAbandoned(uint256 deadline)', 'error SaleClosed()']);
const TO = '0x00000000000000000000000000000000000000a1';
const FROM = '0x00000000000000000000000000000000000000b2';

function client(call: () => Promise<unknown>): PublicClient {
  return { getBlockNumber: async () => 7n, call, estimateGas: async () => 21_000n } as unknown as PublicClient;
}
const revert = (data: `0x${string}`) => async () => {
  throw new BaseError('execution reverted', { cause: new RawContractError({ data }) });
};

describe('simulate', () => {
  it('decodes a custom error with its args and a hint', async () => {
    const data = encodeErrorResult({ abi, errorName: 'NotAbandoned', args: [123n] });
    const s = await simulate(client(revert(data)), { to: TO, data: '0x1234', value: '0' }, { from: FROM, errors: errorAbi(abi) });
    expect(s).toMatchObject({ ok: false, from: FROM, error: 'NotAbandoned', errorArgs: ['123'], gasEstimate: null, blockNumber: '7' });
    expect(s.note).toMatch(/heartbeat window has not passed/);
  });
  it('reads Error(string) reverts as their message', async () => {
    const data = encodeErrorResult({ abi: parseAbi(['error Error(string)']), errorName: 'Error', args: ['closed'] });
    const s = await simulate(client(revert(data)), { to: TO, data: '0x', value: '0' }, { from: null, errors: abi });
    expect(s.ok).toBe(false);
    expect(s.error).toBeNull();
    expect(s.note).toMatch(/Would revert now: closed/);
  });
  it('says a revert may clear once prerequisites land', async () => {
    const data = encodeErrorResult({ abi, errorName: 'SaleClosed' });
    const s = await simulate(client(revert(data)), { to: TO, data: '0x', value: '0' }, { from: FROM, errors: abi, pendingPrerequisites: 1 });
    expect(s.note).toMatch(/1 prerequisite/);
  });
  it('passes and estimates gas', async () => {
    const s = await simulate(client(async () => ({ data: '0x' })), { to: TO, data: '0x', value: '0' }, { from: FROM, errors: abi });
    expect(s).toMatchObject({ ok: true, gasEstimate: '21000', error: null });
  });
});
