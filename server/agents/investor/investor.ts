import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { formatEther, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import type { CovenantSummary, Downside, UnsignedTx } from '../../src/schema.js';

export interface InvestorDecision {
  vault: Address;
  symbol: string | null;
  premiumToBookPct: number | null;
  state: CovenantSummary['state'];
  downside: Downside;
  action: 'redeemed' | 'hold' | 'wait-for-round';
  reason: string;
  txs: Hex[];
}

async function callTool<T>(mcp: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const res = (await mcp.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text?: string }[] };
  const text = res.content.find((c) => c.type === 'text')?.text ?? '';
  if (res.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text) as T;
}

/**
 * The investor agent flow from the demo: find covenants trading under book, compute the downside
 * of its position in each, and redeem at book when a round is open and redemption pays more than
 * selling into the pool. It reaches Covenant only through the MCP server, which returns unsigned
 * transactions; this agent signs them with its own key.
 */
export class InvestorAgent {
  constructor(
    private mcp: Client,
    private wallet: WalletClient,
    private client: PublicClient,
    private opts: { minEdgePct: number; log?: (m: string) => void } = { minEdgePct: 1 },
  ) {}

  get address(): Address {
    return this.wallet.account!.address;
  }

  private log(m: string) {
    (this.opts.log ?? ((x: string) => console.log(`[investor] ${x}`)))(m);
  }

  private async sign(tx: UnsignedTx): Promise<Hex[]> {
    const hashes: Hex[] = [];
    for (const step of [...tx.prerequisites, tx]) {
      const hash = await this.wallet.sendTransaction({
        account: this.wallet.account!,
        chain: this.wallet.chain,
        to: step.to,
        data: step.data,
        value: BigInt(step.value),
      });
      const r = await this.client.waitForTransactionReceipt({ hash });
      if (r.status !== 'success') throw new Error(`${step.functionName} reverted (${hash})`);
      this.log(`sent ${step.functionName} ${hash}`);
      hashes.push(hash);
    }
    return hashes;
  }

  async run(): Promise<InvestorDecision[]> {
    const { covenants } = await callTool<{ covenants: CovenantSummary[] }>(this.mcp, 'list_covenants', { under_book_only: true });
    this.log(`${covenants.length} covenant(s) trading under book value`);
    const out: InvestorDecision[] = [];
    for (const c of covenants) {
      const d = await callTool<Downside>(this.mcp, 'get_downside', { vault: c.vault, holder: this.address });
      const base = { vault: c.vault, symbol: c.symbol, premiumToBookPct: c.premiumToBookPct, state: c.state, downside: d, txs: [] as Hex[] };
      if (BigInt(d.tokensWei) === 0n) {
        out.push({ ...base, action: 'hold', reason: 'no position in this covenant' });
        continue;
      }
      const redeem = d.redeemNowWei ? BigInt(d.redeemNowWei) : 0n;
      const sell = d.sellOnPoolWei ? BigInt(d.sellOnPoolWei) : 0n;
      const edgePct = sell > 0n ? (Number(redeem) / Number(sell) - 1) * 100 : Infinity;
      if (!d.redeemableNow) {
        out.push({ ...base, action: 'wait-for-round', reason: `Under book by ${(-(c.premiumToBookPct ?? 0)).toFixed(1)}% but no exit round is open. ${d.explanation}` });
        continue;
      }
      if (edgePct < this.opts.minEdgePct) {
        out.push({ ...base, action: 'hold', reason: `Redeeming pays ${formatEther(redeem)} BNB against ${formatEther(sell)} BNB on the pool: edge ${edgePct.toFixed(2)}% is under ${this.opts.minEdgePct}%.` });
        continue;
      }
      const { unsignedTransaction } = await callTool<{ unsignedTransaction: UnsignedTx }>(this.mcp, 'redeem', { vault: c.vault, holder: this.address, tokens: d.tokensWei });
      const txs = await this.sign(unsignedTransaction);
      out.push({
        ...base,
        action: 'redeemed',
        txs,
        reason: `${base.state === 'WIND_DOWN' ? 'Wound down: redemption open with no fee.' : 'Exit round open.'} Redeemed ${formatEther(BigInt(d.tokensWei))} tokens for about ${formatEther(redeem)} BNB at book, ${edgePct === Infinity ? 'with no pool bid' : `${edgePct.toFixed(1)}% more than the ${formatEther(sell)} BNB the pool would pay`}.`,
      });
    }
    for (const o of out) this.log(`${o.symbol ?? o.vault}: ${o.action}. ${o.reason}`);
    return out;
  }
}
