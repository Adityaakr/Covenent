import { decodeAbiParameters, encodeAbiParameters } from 'viem';
import { describe, expect, it } from 'vitest';
import { encodeForwardVaultData, encodeLiteInitData, liteProblems } from '../../src/api/fourmeme.js';

const TEMPLATE = '0x343fB27D0334d6C6bD8Bc88BEb0EF3f969394bEf';
const F = { tapBps: 400, tapPeriod: 86_400, heartbeat: 604_800, redeemFeeBps: 100 };

describe('Four.meme ForwardVault params', () => {
  it('wrap (template, initData) as one tuple, the way the live ForwardVault decodes them', () => {
    const data = encodeForwardVaultData(TEMPLATE, F);
    const [t] = decodeAbiParameters(
      [{ type: 'tuple', components: [{ name: 'template', type: 'address' }, { name: 'initData', type: 'bytes' }] }],
      data,
    );
    expect(t.template).toBe(TEMPLATE);
    expect(t.initData).toBe(encodeLiteInitData(F));
    expect(decodeAbiParameters([{ type: 'uint16' }, { type: 'uint32' }, { type: 'uint32' }, { type: 'uint16' }], t.initData)).toEqual([400, 86_400, 604_800, 100]);
    // the flat encoding Four.meme's docs suggest is a different byte string (and reverts on the live ForwardVault)
    const flat = encodeAbiParameters([{ type: 'address' }, { type: 'bytes' }], [TEMPLATE, encodeLiteInitData(F)]);
    expect(data).not.toBe(flat);
    // initData is 4 words, which CovenantLiteVault requires (initParams.length == 128)
    expect((encodeLiteInitData(F).length - 2) / 2).toBe(128);
  });

  it('refuses fields outside the Lite template bounds', () => {
    expect(liteProblems(F)).toEqual([]);
    expect(liteProblems({ ...F, heartbeat: 3600 })).toHaveLength(1);
    expect(liteProblems({ ...F, tapBps: 0, redeemFeeBps: 301 })).toHaveLength(2);
  });
});
