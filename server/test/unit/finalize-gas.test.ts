import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Address, Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import { InvestorAgent } from '../../agents/investor/investor.js';
import { launcherAbi } from '../../src/abi/fallback.js';
import type { ServerConfig } from '../../src/config.js';
import type { CovenantService } from '../../src/covenant/read.js';
import { FINALIZE_GAS_LIMIT, TxBuilder } from '../../src/covenant/tx.js';
import { Keeper } from '../../src/keeper/keeper.js';
import type { UnsignedTx } from '../../src/schema.js';
import { scratchDir } from './scratch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const LAUNCHER: Address = '0x0f3Fe8a8d3e2862E6218f42D6376D28ba3EaDf5E';
const FACTORY: Address = '0x89D7E30109D62F72fBf717aafc2d59d21CA4DC48';
const KEEPER: Address = '0x749fd77172C2F1d213405B0E1005030e3C739add';

// Flap audit flag 2 / re-review F7: finalize() refuses to try the launch with less than 12M gas left, so every caller
// sends an explicit limit instead of trusting an estimate: 15M, the most Flap's vault SDK and flap.sh send.
describe('finalize gas limit', () => {
  it("matches the launcher contract, clears the guard and stays within Flap's 15M cap", () => {
    const src = readFileSync(path.join(ROOT, 'contracts/src/launcher/CovenantLauncher.sol'), 'utf8');
    const limit = src.match(/FINALIZE_GAS_LIMIT = ([\d_]+);/)?.[1]?.replaceAll('_', '');
    const floor = src.match(/LAUNCH_GAS_FLOOR = ([\d_]+);/)?.[1]?.replaceAll('_', '');
    expect(limit).toBeDefined();
    expect(BigInt(limit!)).toBe(FINALIZE_GAS_LIMIT);
    expect(FINALIZE_GAS_LIMIT).toBeGreaterThanOrEqual(BigInt(floor!) + 2_500_000n);
    expect(FINALIZE_GAS_LIMIT).toBeLessThanOrEqual(15_000_000n);
  });

  it('the unsigned finalize() the API and MCP hand out carries it', async () => {
    const svc = { cfg: { chainId: 97 }, abis: { launcher: launcherAbi } } as unknown as CovenantService;
    const tx = await new TxBuilder(svc).finalize({ launcher: LAUNCHER });
    expect(tx.functionName).toBe('finalize');
    expect(tx.to).toBe(LAUNCHER);
    expect(tx.gas).toBe(FINALIZE_GAS_LIMIT.toString());
  });

  it('the investor agent sends the gas an unsigned transaction carries', async () => {
    const sent: Record<string, unknown>[] = [];
    const wallet = {
      account: { address: KEEPER },
      chain: undefined,
      sendTransaction: async (p: Record<string, unknown>) => {
        sent.push(p);
        return '0xabc' as Hex;
      },
    };
    const client = { waitForTransactionReceipt: async () => ({ status: 'success' }) };
    const agent = new InvestorAgent({} as never, wallet as never, client as never, { minEdgePct: 1, log: () => {} });
    const tx: UnsignedTx = {
      chainId: 97, to: LAUNCHER, data: '0x4bb278f3', value: '0', from: null, functionName: 'finalize', description: '',
      gas: FINALIZE_GAS_LIMIT.toString(), prerequisites: [],
    };
    await (agent as unknown as { sign(t: UnsignedTx): Promise<Hex[]> }).sign(tx);
    expect(sent[0]!.gas).toBe(FINALIZE_GAS_LIMIT);
  });

  it('the keeper finalizes a raise past its deadline with the limit, and leaves an open one alone', async () => {
    const dir = scratchDir('keeper-finalize');
    const now = 1_800_000_000;
    const launchers: Record<string, { state: number; deadline: number }> = {
      [LAUNCHER]: { state: 0, deadline: now - 10 },
      '0x2CB32e64149Ce7EFF53d131eD01224b7f1F2f2Ce': { state: 0, deadline: now + 3600 },
    };
    const calls: Record<string, unknown>[] = [];
    const sends: Record<string, unknown>[] = [];
    const client = {
      readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
        if (functionName === 'allLaunchers') return Object.keys(launchers);
        const l = launchers[address];
        if (!l) throw new Error('unknown');
        return functionName === 'state' ? l.state : BigInt(l.deadline);
      },
      call: async (p: Record<string, unknown>) => {
        calls.push(p);
        return { data: '0x' };
      },
      waitForTransactionReceipt: async () => ({ status: 'success', blockNumber: 1n }),
      getTransactionReceipt: async () => ({ status: 'success', blockNumber: 1n }),
      getBlock: async () => ({ timestamp: BigInt(now) }),
    };
    const wallet = {
      account: { address: KEEPER },
      chain: undefined,
      sendTransaction: async (p: Record<string, unknown>) => {
        sends.push(p);
        return '0xfeed' as Hex;
      },
    };
    const cfg = {
      chainId: 97,
      launcherFactories: [FACTORY],
      keeper: { stateFile: path.join(dir, 'state.json'), alertsFile: path.join(dir, 'alerts.jsonl'), tickSeconds: 60, pokeIntervalSeconds: 3600, dispatchTax: false },
    } as unknown as ServerConfig;
    const svc = { cfg, client, abis: { launcher: launcherAbi } } as unknown as CovenantService;
    const keeper = new Keeper({ cfg, svc, wallet: wallet as never, log: () => {}, finalize: true });
    const res = await keeper.finalizeDue(now);
    expect(res).toEqual([{ launcher: LAUNCHER, action: 'finalized', tx: '0xfeed' }]);
    expect(sends).toHaveLength(1);
    expect(sends[0]!.to).toBe(LAUNCHER);
    expect(sends[0]!.gas).toBe(FINALIZE_GAS_LIMIT);
    expect(calls[0]!.gas).toBe(FINALIZE_GAS_LIMIT); // the simulation uses it too
    const alerts = readFileSync(path.join(dir, 'alerts.jsonl'), 'utf8');
    expect(alerts).toContain('raise-finalized');
  });
});
