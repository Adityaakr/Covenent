import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../src/config.js';
import { FINALIZE_GAS, TESTNET_TX_GAS_CEILING } from '../../src/covenant/gas.js';

const num = (s: string) => BigInt(s.replace(/_/g, ''));

describe('finalize gas, one value everywhere', () => {
  it('sits above the launcher floor and under the BNB testnet ceiling', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'contracts', 'src', 'launcher', 'CovenantLauncher.sol'), 'utf8');
    const floor = num(src.match(/LAUNCH_GAS_FLOOR\s*=\s*([\d_]+)/)![1]!);
    // finalize spends some gas before it checks gasleft() against the floor
    expect(FINALIZE_GAS).toBeGreaterThan(floor + 500_000n);
    expect(FINALIZE_GAS).toBeLessThan(TESTNET_TX_GAS_CEILING);
  });
  it('matches the web app copy (web/src/lib/data/actions.ts)', () => {
    const web = readFileSync(path.join(REPO_ROOT, 'web', 'src', 'lib', 'data', 'actions.ts'), 'utf8');
    expect(num(web.match(/const FINALIZE_GAS = ([\d_]+)n/)![1]!)).toBe(FINALIZE_GAS);
  });
});
