/**
 * Flap's audit bot re-review, F5 on the keeper side: the oracle now lets a poke that carries a verified rate through
 * whenever the previous poke WITH a rate is a gap old, however recently someone poked without one. The keeper must
 * follow: someone else's plain poke must not make it skip its report, and it must not spam plain pokes when it has no
 * rate to bring.
 */
import { getAddress, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { describe, expect, it } from 'vitest';
import type { AtlasReport } from '../../src/atlas/report.js';
import { loadConfig, type Deployments } from '../../src/config.js';
import { CovenantService } from '../../src/covenant/read.js';
import { Keeper } from '../../src/keeper/keeper.js';
import { keeperFiles } from './scratch.js';

const VAULT = getAddress('0x0000000000000000000000000000000000000ba1');
const ORACLE = getAddress('0x00000000000000000000000000000000000000c1');
const KEEPER = getAddress('0x000000000000000000000000000000000000a11c');
const NOW = 1_000_000;
const REPORT: AtlasReport = {
  mode: 'local-test-signer',
  extraData: `0x${'ab'.repeat(88)}` as Hex,
  feedId: '0x00000001',
  bnbUsd: '600',
  timestamp: NOW,
  signer: KEEPER,
  note: 'test report',
};

function setup(o: { plainAgo: number; rateAgo: number; push: bigint; report: AtlasReport | null }) {
  const sent: Hex[] = [];
  const client = {
    async getBlock() {
      return { timestamp: BigInt(NOW), number: 100n };
    },
    async getChainId() {
      return 31337;
    },
    async readContract({ address, functionName }: { address: Address; functionName: string }) {
      if (getAddress(address) !== ORACLE) throw new Error(`no ${functionName}`);
      if (functionName === 'points') return [0n, 0, 0n, BigInt(NOW - o.plainAgo), true];
      if (functionName === 'ratePoints') return [0n, 0, BigInt(NOW - o.rateAgo)];
      if (functionName === 'pushBnbUsd') return o.push;
      throw new Error(`no ${functionName}`);
    },
    async call() {
      return { data: '0x' };
    },
    async waitForTransactionReceipt() {
      return { status: 'success', blockNumber: 100n };
    },
    async getTransactionReceipt() {
      return { status: 'success', blockNumber: 100n };
    },
  } as unknown as PublicClient;
  const deployments: Deployments = { chainId: 31337, rpcUrl: 'http://127.0.0.1:8545', addresses: { oracle: ORACLE } };
  const base = loadConfig({ deployments, rpcUrl: 'http://127.0.0.1:8545', chainId: 31337, covenants: [], launcherFactories: [] });
  const cfg = {
    ...base,
    oracle: ORACLE,
    keeper: { ...base.keeper, pokeIntervalSeconds: 3_600, ...keeperFiles('keeper-f5') },
  };
  const svc = new CovenantService({ cfg, client });
  const wallet = {
    account: { address: KEEPER },
    chain: undefined,
    async sendTransaction({ data }: { data: Hex }) {
      sent.push(data);
      return `0x${'11'.repeat(32)}` as Hex;
    },
  } as unknown as WalletClient;
  const keeper = new Keeper({ cfg, svc, wallet, log: () => {} });
  keeper.report = async () => o.report;
  return { keeper, sent };
}

describe('Flap re-review F5: a plain poke never makes the keeper skip its report', () => {
  it('someone poked without a report a minute ago; the keeper still sends its report-carrying poke', async () => {
    const { keeper, sent } = setup({ plainAgo: 60, rateAgo: 3_700, push: 0n, report: REPORT });
    const r = await keeper.pokeOne({ vault: VAULT }, NOW);
    expect(r.action).toBe('poked');
    expect(r.reportMode).toBe('local-test-signer');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.endsWith('ab'.repeat(88))).toBe(true);
  });

  it('with a fresh push round (BNB testnet) the plain-looking poke carries a rate, so it is sent too', async () => {
    const { keeper, sent } = setup({ plainAgo: 60, rateAgo: 3_700, push: 600n * 10n ** 18n, report: null });
    const r = await keeper.pokeOne({ vault: VAULT }, NOW);
    expect(r.action).toBe('poked');
    expect(sent).toHaveLength(1);
  });

  it('no report and no fresh push round: it does not repeat the plain poke that just landed', async () => {
    const { keeper, sent } = setup({ plainAgo: 60, rateAgo: 3_700, push: 0n, report: null });
    const r = await keeper.pokeOne({ vault: VAULT }, NOW);
    expect(r.action).toBe('skipped');
    expect(r.reason).toMatch(/no rate to bring/);
    expect(sent).toHaveLength(0);
  });

  it('both pokes recent: not due', async () => {
    const { keeper, sent } = setup({ plainAgo: 60, rateAgo: 120, push: 0n, report: REPORT });
    const r = await keeper.pokeOne({ vault: VAULT }, NOW);
    expect(r.action).toBe('skipped');
    expect(r.reason).toMatch(/not due/);
    expect(sent).toHaveLength(0);
  });
});
