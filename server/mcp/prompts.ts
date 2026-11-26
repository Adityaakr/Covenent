import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import { downside } from '../src/covenant/downside.js';
import type { CovenantService, ResolvedCovenant } from '../src/covenant/read.js';
import { sanitizeText, untrustedBlock } from '../src/safety.js';

const here = path.dirname(fileURLToPath(import.meta.url));

interface Ctx {
  svc: CovenantService;
  network: () => Promise<Record<string, unknown>>;
  resolve: (covenant: string) => Promise<ResolvedCovenant>;
}

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x address');

/** The on-chain facts a prompt embeds, with every third-party string sanitized. */
async function snapshot(ctx: Ctx, covenant: string) {
  const r = await ctx.resolve(covenant);
  if (!r.vault) return { resolved: r, raise: r.launcher ? await ctx.svc.launcherInfo(r.launcher) : null };
  const s = await ctx.svc.sheet(r.vault);
  return {
    resolved: { vault: s.vault, launcher: s.launcher, token: s.token, pair: s.pool.pair },
    name: sanitizeText(s.name, 64),
    symbol: sanitizeText(s.symbol, 24),
    state: s.state,
    treasuryBnb: s.treasuryBnb,
    bookValueBnb: s.bookValueBnb,
    poolPriceBnb: s.poolPriceBnb,
    premiumToBookPct: s.premiumToBookPct,
    floorShareOfSale: s.floorShareOfSale,
    terms: s.terms,
    exit: s.exit,
    tap: s.tap,
    heartbeat: s.heartbeat,
    issuer: { teamWallet: s.issuer.teamWallet, agentId: s.issuer.agentId, ownerMatchesTeam: s.issuer.ownerMatchesTeam },
    chainId: s.chainId,
    chainTime: s.readAt,
  };
}

const user = (text: string) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] });

/** Resources (network, guide, one covenant) and prompts (explain, should I redeem, before you commit). */
export function registerPromptsAndResources(server: McpServer, ctx: Ctx): void {
  server.registerResource(
    'network',
    'covenant://network',
    { title: 'Network and deployment', description: 'Chain, redacted RPC, contract addresses and server limits (same as get_network).', mimeType: 'application/json' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await ctx.network(), null, 2) }] }),
  );

  server.registerResource(
    'guide',
    'covenant://guide',
    { title: 'Covenant agent guide', description: 'The five rules, every tool, and recipes for investors and issuers (server/mcp/SKILL.md).', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: readFileSync(path.join(here, 'SKILL.md'), 'utf8') }] }),
  );

  server.registerResource(
    'covenant',
    new ResourceTemplate('covenant://covenants/{address}', {
      list: async () => ({
        resources: (await ctx.svc.list().catch(() => [])).map((c) => ({
          uri: `covenant://covenants/${c.vault}`,
          name: `${sanitizeText(c.symbol, 24) ?? 'covenant'} ${c.vault}`,
          mimeType: 'application/json',
        })),
      }),
    }),
    { title: 'One covenant', description: 'Snapshot of one covenant by any of its addresses: state, treasury, book value, terms, exit, tap, heartbeat.', mimeType: 'application/json' },
    async (uri, { address }) => {
      const a = String(Array.isArray(address) ? address[0] : address);
      if (!isAddress(a)) throw new Error('covenant://covenants/{address} needs a 0x address');
      return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await snapshot(ctx, a), null, 2) }] };
    },
  );

  server.registerPrompt(
    'explain_covenant',
    {
      title: 'Explain this covenant',
      description: 'Plain-language explanation of one covenant: what holders are protected by, what is at risk, and its state today.',
      argsSchema: { covenant: addr.describe('vault, token, launcher or pool address') },
    },
    async ({ covenant }) =>
      user(
        [
          'Explain this Covenant token raise to a holder in plain language, in under 250 words.',
          'Cover: the five rules with their numbers (tap, performance unlock, book-value exit, abandonment switch, disclosure), what a holder gets back if things go wrong (book value and how it moves), and the state today.',
          'Say clearly what the covenant does not protect: the floor sits below the sale price and falls as the team spends; the treasury is BNB; holders get exit, not voice.',
          `For detail call get_terms, get_status and get_issuer with covenant ${getAddress(covenant)}.`,
          '',
          untrustedBlock('covenant snapshot', await snapshot(ctx, covenant)),
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'should_i_redeem',
    {
      title: 'Should I redeem?',
      description: 'Compare redeeming at book with selling into the pool for one wallet, and say whether redemption is open.',
      argsSchema: { covenant: addr.describe('vault, token, launcher or pool address'), wallet: addr.describe('the holder') },
    },
    async ({ covenant, wallet }) => {
      const r = await ctx.resolve(covenant);
      const d = r.vault ? await downside(ctx.svc, r.vault, { holder: getAddress(wallet) }) : null;
      return user(
        [
          `Decide whether wallet ${getAddress(wallet)} should redeem its Covenant tokens at book value now.`,
          'Rules: redemption is possible only when redeemableNow is true (EXIT_ROUND or WIND_DOWN). If it is, compare redeemNowWei with sellOnPoolWei: redeem when it pays more, net of the exit fee already applied.',
          'If redemption is not open, say what would open it (exit streak progress, abandonment) and when, using get_status and get_actions.',
          'If you recommend redeeming, call the redeem tool to build the unsigned transaction and show its simulation; never ask for a private key.',
          '',
          untrustedBlock('position downside', d ?? { note: 'this covenant has not launched; there is nothing to redeem' }),
        ].join('\n'),
      );
    },
  );

  server.registerPrompt(
    'before_you_commit',
    {
      title: 'Before you commit',
      description: 'Due diligence before funding a raise: terms, worst case at book, issuer identity and reputation, and the raise itself.',
      argsSchema: { covenant: addr.describe('vault, token, launcher or pool address'), amount_bnb: z.string().regex(/^\d+(\.\d{1,18})?$/).optional().describe('BNB you plan to commit') },
    },
    async ({ covenant, amount_bnb }) =>
      user(
        [
          `Do due diligence on this Covenant raise before committing${amount_bnb ? ` ${amount_bnb} BNB` : ''}.`,
          'Steps: get_raise (is it open, how full, when it closes), get_terms (the five rules), get_issuer (team wallet, ERC-8004 identity, ownerMatchesTeam, reputation counted only from covenant vaults), and get_downside with your expected allocation for the worst case at book.',
          'Then give a short verdict with the main risks. If the user goes ahead, call commit to build the unsigned transaction with its simulation; the user signs it in their own wallet.',
          '',
          untrustedBlock('covenant snapshot', await snapshot(ctx, covenant)),
        ].join('\n'),
      ),
  );
}
