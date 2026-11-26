import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAddress, isAddress, keccak256, parseEther, toBytes, type Address, type Hex } from 'viem';
import { z } from 'zod';
import { CMC_ROUTES, CmcClient } from '../src/api/cmc.js';
import { fetchBnbUsdReport, NoPullReport } from '../src/atlas/report.js';
import type { ServerConfig } from '../src/config.js';
import { downside } from '../src/covenant/downside.js';
import { settle } from '../src/covenant/math.js';
import { CovenantService } from '../src/covenant/read.js';
import { TxBuilder } from '../src/covenant/tx.js';
import type { CovenantSheet, UnsignedTx } from '../src/schema.js';

const address = z.string().refine((v) => isAddress(v), 'must be a 0x address').describe('0x address');
const vaultArg = { vault: address.describe('Covenant vault address (from list_covenants)') };

const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }] });

function unsigned(tx: UnsignedTx, note?: string) {
  return json({
    unsignedTransaction: tx,
    howToSend:
      'This server holds no keys. Sign and send with the wallet that should act' +
      (tx.from ? ` (expected signer ${tx.from})` : '') +
      (tx.prerequisites.length ? '; send each prerequisite first, in order.' : '.'),
    ...(note ? { note } : {}),
  });
}

function days(s: number | null) {
  if (s === null) return 'unknown';
  return s >= 86_400 ? `${+(s / 86_400).toFixed(2)} days` : s >= 3600 ? `${+(s / 3600).toFixed(2)} hours` : `${s} seconds`;
}

export function termsSummary(s: CovenantSheet): string {
  const t = s.terms;
  const tranches = s.tranches.map((k) => `${k.multiple}x`).join(', ');
  return [
    `Tap: the team can draw $${t.tapUsdPer30d ?? '?'} per 30 days at the Atlas BNB/USD rate, never more than ${(t.tapCapBps ?? 0) / 100}% of the treasury per 30 days. It can only be lowered.`,
    `Performance unlock: ${s.tranches.length} team tranches unlock at ${tranches || 'n/a'} the sale price in dollars, each after ${days(t.unlockWindowSeconds)} of trusted observations above its multiple.`,
    `Book-value exit: if the pool trades below book value for ${days(t.exitStreakSeconds)} of observed time (the streak decays above book, it does not reset, and it needs no oracle), a ${days(t.roundLengthSeconds)} exit round opens where any holder can burn tokens for their share of the treasury, less a ${(t.exitFeeBps ?? 0) / 100}% fee. A ${days(t.cooldownSeconds)} cooldown follows.`,
    `Abandonment switch: if the team or agent stops and sends no heartbeat for ${days(t.heartbeatSeconds)}, anyone can open the treasury to holders permanently, fee-free, and the locked team tokens burn.`,
    `Today: treasury ${s.treasuryBnb} BNB, book value ${s.bookValueBnb ?? '?'} BNB per token, which is ${s.floorShareOfSale === null ? '?' : (s.floorShareOfSale * 100).toFixed(1) + '%'} of the sale price. The floor falls as the team spends and rises with tax and revenue.`,
  ].join('\n');
}

export interface McpDeps {
  cfg: ServerConfig;
  svc?: CovenantService;
  cmc?: CmcClient;
}

/**
 * Covenant MCP server (docs/DESIGN.md "Covenant MCP server"). Reads are the same calls the app
 * uses. Writes return unsigned transactions only: the server never holds or asks for a key.
 */
export function createMcpServer(deps: McpDeps): McpServer {
  const { cfg } = deps;
  const svc = deps.svc ?? new CovenantService({ cfg });
  const txb = new TxBuilder(svc);
  const cmc = deps.cmc ?? new CmcClient(cfg.cmc.apiKey, cfg.cmc.baseUrl);
  const server = new McpServer(
    { name: 'covenant', version: '0.1.0' },
    {
      instructions:
        'Covenant: token raises on BNB Chain whose treasury sits in a vault under five fixed rules (tap, performance unlock, ' +
        'book-value exit, abandonment switch, disclosure). Start with list_covenants, then get_terms / get_status / get_downside ' +
        'on a vault address. Write tools never sign: they return an unsigned transaction ({chainId, to, data, value, from, ' +
        'prerequisites[]}); send each prerequisite first, then the transaction, from the wallet named in from. Amounts are wei ' +
        'strings; per-token prices are BNB per token x 1e18. redeem works only in EXIT_ROUND or WIND_DOWN; claim_tap, heartbeat, ' +
        'lower_tap and post_report must be signed by the team wallet.',
    },
  );
  const read = { readOnlyHint: true, openWorldHint: false };
  const write = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }; // builds a tx, changes nothing itself

  server.registerTool(
    'list_covenants',
    {
      title: 'List covenants',
      description: 'Every known covenant with token, state, treasury, book value, pool price and premium or discount to book. Use under_book_only to find covenants trading below treasury value per token.',
      inputSchema: { under_book_only: z.boolean().optional().describe('only covenants whose pool price is below book value') },
      annotations: read,
    },
    async ({ under_book_only }) => {
      try {
        const all = await svc.list();
        return json({ covenants: under_book_only ? all.filter((c) => c.premiumToBookPct !== null && c.premiumToBookPct < 0) : all });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_terms',
    { title: 'Get terms', description: 'The covenant terms as JSON plus a plain-language summary of the five rules.', inputSchema: vaultArg, annotations: read },
    async ({ vault }) => {
      try {
        const s = await svc.sheet(vault);
        return json({ terms: s.terms, tranches: s.tranches, salePriceWei: s.salePriceWei, launcher: s.launcherInfo, summary: termsSummary(s) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_status',
    {
      title: 'Get status',
      description: 'State, exit streak and round end, tap accrued and cap, heartbeat age, tranche progress and the last trust result.',
      inputSchema: vaultArg,
      annotations: read,
    },
    async ({ vault }) => {
      try {
        const s = await svc.sheet(vault);
        return json({
          state: s.state,
          exit: s.exit,
          tap: s.tap,
          heartbeat: s.heartbeat,
          tranches: s.tranches,
          trust: s.trust,
          treasuryBnb: s.treasuryBnb,
          bookValueBnb: s.bookValueBnb,
          poolPriceBnb: s.poolPriceBnb,
          premiumToBookPct: s.premiumToBookPct,
          chainTime: s.readAt,
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_downside',
    {
      title: 'Get downside',
      description: 'What a position redeems for at book today, what the pool would pay instead, floor as a share of sale price now and after 6, 12, 24 months at the tap cap, and runway. Give holder (reads its balance) or tokens (wei).',
      inputSchema: { ...vaultArg, holder: address.optional(), tokens: z.string().regex(/^\d+$/).optional().describe('token amount in wei (18 decimals)') },
      annotations: read,
    },
    async ({ vault, holder, tokens }) => {
      try {
        return json(await downside(svc, vault, { holder: holder ? getAddress(holder) : undefined, tokensWei: tokens ? BigInt(tokens) : undefined }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_issuer',
    {
      title: 'Get issuer',
      description: 'Team wallet, ERC-8004 agent id, registration file, whether the identity owner is the team wallet, and outcomes of its past covenants (reputation feedback written only by covenant vaults).',
      inputSchema: vaultArg,
      annotations: read,
    },
    async ({ vault }) => {
      try {
        return json((await svc.sheet(vault)).issuer);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'get_market',
    {
      title: 'Get market',
      description: 'Pair quote, liquidity and holders from the CoinMarketCap DEX API, plus the on-chain pool reserves.',
      inputSchema: vaultArg,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ vault }) => {
      try {
        const s = await svc.sheet(vault);
        const onchain = { pair: s.pool.pair, reserveBnbWei: s.pool.reserveBnbWei, reserveTokenWei: s.pool.reserveTokenWei, poolPriceBnb: s.poolPriceBnb };
        if (cfg.chainId !== 56 || !s.pool.pair) {
          return json({ onchain, coinmarketcap: null, note: `Chain ${cfg.chainId} is not BNB Chain mainnet, so CoinMarketCap has no data for this pair. On-chain reserves shown.` });
        }
        const quote = await cmc.call(CMC_ROUTES.find((r) => r.name === 'pair-quote')!, { network_id: '14', contract_address: s.pool.pair });
        return json({ onchain, coinmarketcap: { mode: quote.mode, status: quote.status, body: quote.body } });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'commit',
    {
      title: 'Commit to a raise',
      description: 'Unsigned contribute() transaction for the raise, with the expected pro-rata outcome if the raise closed now.',
      inputSchema: { ...vaultArg, amount_bnb: z.string().regex(/^\d+(\.\d+)?$/).describe('BNB to commit, e.g. "1.5"') },
      annotations: write,
    },
    async ({ vault, amount_bnb }) => {
      try {
        const amount = parseEther(amount_bnb);
        const s = await svc.sheet(vault);
        const tx = await txb.commit({ vault }, amount);
        const li = s.launcherInfo;
        let note: string | undefined;
        if (li?.committedWei && li.capWei) {
          const total = BigInt(li.committedWei) + amount;
          const r = settle(amount, total, BigInt(li.capWei), 0n);
          note = `If the raise closed now with your commitment, ${Number(r.accepted) / 1e18} BNB would be accepted and ${Number(r.refund) / 1e18} BNB refunded${li.minRaiseWei && total < BigInt(li.minRaiseWei) ? '; the raise is below its minimum, so today everything would be refunded' : ''}. Launcher state: ${li.state}.`;
        }
        return unsigned(tx, note);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool('claim_tokens', { title: 'Claim tokens', description: 'Unsigned claimTokens() for the vault: withdraw your sale allocation.', inputSchema: vaultArg, annotations: write }, async ({ vault }) => {
    try {
      return unsigned(txb.claimTokens(vault));
    } catch (e) {
      return fail(e);
    }
  });

  server.registerTool('claim_refund', { title: 'Claim refund', description: 'Unsigned claimRefund() for the launcher: the unaccepted part, or everything if the raise failed.', inputSchema: vaultArg, annotations: write }, async ({ vault }) => {
    try {
      return unsigned(await txb.claimRefund({ vault }));
    } catch (e) {
      return fail(e);
    }
  });

  server.registerTool(
    'redeem',
    {
      title: 'Redeem at book value',
      description: 'Unsigned redeem(amount, minOut), with a token approval first if needed. Works only in an exit round or after wind-down; says so otherwise.',
      inputSchema: { ...vaultArg, holder: address.describe('the wallet that holds the tokens and will sign'), tokens: z.string().regex(/^\d+$/).optional().describe('token amount in wei; default: whole balance'), slippage_bps: z.number().int().min(0).max(1000).optional() },
      annotations: write,
    },
    async ({ vault, holder, tokens, slippage_bps }) => {
      try {
        const s = await svc.sheet(vault);
        const h = getAddress(holder);
        const amount = tokens ? BigInt(tokens) : s.token ? await svc.tokenBalance(s.token, h) : 0n;
        if (amount === 0n) throw new Error('holder has no tokens to redeem');
        return unsigned(await txb.redeem(vault, amount, h, slippage_bps ?? 50));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'poke',
    {
      title: 'Poke',
      description: 'Unsigned CovenantOracle.poke(vault) with a fresh signed BNB/USD report appended (Atlas, or the local test signer on a local chain with no Atlas key). On BNB testnet with no Atlas key it is a plain poke and the oracle reads the Atlas push feed. Anyone can send it; the oracle refuses pokes closer together than its minimum interval.',
      inputSchema: vaultArg,
      annotations: write,
    },
    async ({ vault }) => {
      try {
        let rep;
        try {
          rep = await fetchBnbUsdReport(cfg.atlas, svc.client);
        } catch (e) {
          // No pull report to attach (BNB testnet without an Atlas key): a plain poke, as the keeper sends.
          if (e instanceof NoPullReport) return unsigned(txb.poke(vault), e.message);
          throw e;
        }
        return unsigned(txb.poke(vault, rep), `${rep.note} Report timestamp ${rep.timestamp}; it is valid for about 180 seconds.`);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'declare_abandoned',
    { title: 'Declare abandoned', description: 'Unsigned declareAbandoned(): valid once the team or agent has been silent past its heartbeat window.', inputSchema: vaultArg, annotations: write },
    async ({ vault }) => {
      try {
        const s = await svc.sheet(vault);
        return unsigned(txb.declareAbandoned(vault), s.heartbeat.abandonable ? 'Due now.' : `Not due: would revert. Heartbeat due at ${s.heartbeat.dueAt} (chain time now ${s.readAt}).`);
      } catch (e) {
        return fail(e);
      }
    },
  );

  const teamOnly = (name: string, title: string, description: string, build: (vault: Address) => Promise<UnsignedTx>) =>
    server.registerTool(name, { title, description: `${description} Issuer only: the unsigned transaction must be signed by the team wallet.`, inputSchema: vaultArg, annotations: write }, async ({ vault }) => {
      try {
        return unsigned(await build(getAddress(vault)));
      } catch (e) {
        return fail(e);
      }
    });
  teamOnly('claim_tap', 'Claim tap', 'Unsigned claimTap(): pay the accrued tap to the team wallet; also a heartbeat.', (v) => txb.claimTap(v));
  teamOnly('heartbeat', 'Heartbeat', 'Unsigned heartbeat(): reset the abandonment clock.', (v) => txb.heartbeat(v));

  server.registerTool(
    'lower_tap',
    {
      title: 'Lower tap',
      description: 'Unsigned lowerTap(newUsd): a pay cut that can never be undone. Issuer only.',
      inputSchema: { ...vaultArg, usd_per_30d: z.string().regex(/^\d+(\.\d+)?$/).describe('new tap in dollars per 30 days, e.g. "20000"') },
      annotations: write,
    },
    async ({ vault, usd_per_30d }) => {
      try {
        return unsigned(await txb.lowerTap(vault, parseEther(usd_per_30d)));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'post_report',
    {
      title: 'Post report',
      description: 'Unsigned postReport(period, uri, hash). Give the report text to hash it here, or the hash directly. Issuer only.',
      inputSchema: {
        ...vaultArg,
        period: z.number().int().min(1),
        uri: z.string().min(1),
        report_text: z.string().optional(),
        hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
      },
      annotations: write,
    },
    async ({ vault, period, uri, report_text, hash }) => {
      try {
        const h = (hash as Hex | undefined) ?? (report_text !== undefined ? keccak256(toBytes(report_text)) : undefined);
        if (!h) throw new Error('give report_text or hash');
        return unsigned(await txb.postReport(vault, BigInt(period), uri, h));
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}

export const TOOL_NAMES = [
  'list_covenants', 'get_terms', 'get_status', 'get_downside', 'get_issuer', 'get_market',
  'commit', 'claim_tokens', 'claim_refund', 'redeem', 'poke', 'declare_abandoned',
  'claim_tap', 'heartbeat', 'lower_tap', 'post_report',
] as const;
