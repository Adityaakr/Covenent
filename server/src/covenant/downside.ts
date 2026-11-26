import { formatEther, type Address } from 'viem';
import type { Downside } from '../schema.js';
import { floorAfter, redeemOut, runwayMonthsAtCap, sellQuote, toNum } from './math.js';
import type { CovenantService } from './read.js';

/**
 * What a position is worth if things go wrong: redemption at book today, the pool alternative,
 * the floor as a share of sale price now and along the tap-cap path, and runway.
 */
export async function downside(
  svc: CovenantService,
  vault: string,
  opts: { holder?: Address; tokensWei?: bigint },
): Promise<Downside> {
  const s = await svc.sheet(vault);
  let tokens = opts.tokensWei ?? 0n;
  if (opts.tokensWei === undefined && opts.holder && s.token) tokens = await svc.tokenBalance(s.token, opts.holder);
  const book = s.bookValueWei ? BigInt(s.bookValueWei) : null;
  const windDown = s.state === 'WIND_DOWN';
  const redeemNow = book === null ? null : redeemOut(tokens, book, s.exit.exitFeeBps ?? 0, windDown);
  const sell =
    s.pool.reserveBnbWei && s.pool.reserveTokenWei
      ? sellQuote(tokens, BigInt(s.pool.reserveTokenWei), BigInt(s.pool.reserveBnbWei))
      : null;
  const redeemable = s.state === 'EXIT_ROUND' || windDown;
  const cap = s.tap.capBps;
  const floorPath = [0, 6, 12, 24].map((m) => ({
    months: m,
    floorShareOfSale: s.floorShareOfSale === null || cap === null ? null : floorAfter(s.floorShareOfSale, cap, m),
  }));

  const parts: string[] = [];
  if (redeemNow !== null) {
    parts.push(
      `${formatEther(tokens)} tokens redeem for ${formatEther(redeemNow)} BNB at book value${windDown ? ' (no fee at wind-down)' : ` after the ${(s.exit.exitFeeBps ?? 0) / 100}% exit fee`}.`,
    );
  }
  if (sell !== null) parts.push(`Selling them into the pool would pay about ${formatEther(sell)} BNB before token tax.`);
  parts.push(
    redeemable
      ? 'Redemption is open now.'
      : s.state === 'ACTIVE'
        ? `Redemption opens only in an exit round: after the pool trades below book for ${s.exit.targetSeconds ?? '?'} s of observed time (the streak decays, it does not reset).`
        : `Redemption is not open in state ${s.state}.`,
  );
  if (s.floorShareOfSale !== null) parts.push(`The floor is ${(s.floorShareOfSale * 100).toFixed(1)}% of the sale price and falls as the team spends.`);

  return {
    vault: s.vault,
    holder: opts.holder ?? null,
    tokensWei: tokens.toString(),
    bookValueWei: s.bookValueWei,
    redeemNowWei: redeemNow === null ? null : redeemNow.toString(),
    redeemNowBnb: toNum(redeemNow),
    sellOnPoolWei: sell === null ? null : sell.toString(),
    sellOnPoolBnb: toNum(sell),
    floorShareOfSale: s.floorShareOfSale,
    redeemableNow: redeemable,
    runwayMonthsAtCap: runwayMonthsAtCap(cap),
    floorPath,
    explanation: parts.join(' '),
  };
}
