/** Pure covenant math shared by the API, MCP tools, agents and the simulator. */

export const WAD = 10n ** 18n;
export const DAY = 86_400;
export const MONTH = 30 * DAY;

export function toNum(wei: bigint | null | undefined, decimals = 18): number | null {
  if (wei === null || wei === undefined) return null;
  // safe for display: split to avoid precision loss on huge integers
  const s = 10n ** BigInt(decimals);
  return Number(wei / s) + Number(wei % s) / Number(s);
}

/** Book value per token (1e18), from the doc: (T - owedTeam) * 1e18 / R */
export function bookValue(treasuryWei: bigint, owedTeamWei: bigint, redeemableSupply: bigint): bigint {
  if (redeemableSupply === 0n) return 0n;
  const net = treasuryWei > owedTeamWei ? treasuryWei - owedTeamWei : 0n;
  return (net * WAD) / redeemableSupply;
}

/** What `tokens` redeem for at book `b`, with the exit fee unless winding down (fee is zero there). */
export function redeemOut(tokens: bigint, b: bigint, exitFeeBps: number, windDown: boolean): bigint {
  const gross = (tokens * b) / WAD;
  return windDown ? gross : gross - (gross * BigInt(exitFeeBps)) / 10_000n;
}

/** Constant-product quote for selling `amountIn` tokens into a PancakeSwap V2 pair (0.25% LP fee), before token tax. */
export function sellQuote(amountIn: bigint, reserveToken: bigint, reserveBnb: bigint, feeBps = 25n): bigint {
  if (amountIn === 0n || reserveToken === 0n || reserveBnb === 0n) return 0n;
  const inWithFee = amountIn * (10_000n - feeBps);
  return (inWithFee * reserveBnb) / (reserveToken * 10_000n + inWithFee);
}

/** Floor as a share of sale price after `months` with the tap cap binding and no tax or redemptions. */
export function floorAfter(startShare: number, capBps: number, months: number): number {
  return startShare * Math.pow(1 - capBps / 10_000, months);
}

/** Starting floor from the split: b0 / p0 = (A - P) / (A + P) */
export function startingFloor(saleBps: number, poolBps: number): number {
  return (saleBps - poolBps) / (saleBps + poolBps);
}

/** Months to spend the treasury at today's maximum monthly draw (the cap shrinks with the treasury, so it never empties). */
export function runwayMonthsAtCap(capBps: number | null): number | null {
  if (!capBps) return null;
  return 10_000 / capBps;
}

/**
 * Raise settlement from the doc: Q = min(C, cap), q_i = floor(c_i * Q / C), a_i = A * q_i / Q.
 * Returned so the MCP's commit tool can show a buyer the expected outcome before signing.
 */
export function settle(commitment: bigint, committedTotal: bigint, cap: bigint, saleTokens: bigint) {
  const total = committedTotal;
  const Q = total < cap ? total : cap;
  const q = total === 0n ? 0n : (commitment * Q) / total;
  const a = Q === 0n ? 0n : (saleTokens * q) / Q;
  return { accepted: q, refund: commitment - q, tokens: a, acceptedTotal: Q };
}

/** Seconds until an exit round would open at the current price, under the decaying streak (fix 1). */
export function exitEta(streak: number | null, target: number | null, priceBelowBook: boolean): number | null {
  if (streak === null || target === null || !priceBelowBook) return null;
  return Math.max(0, target - streak);
}

export function median(xs: number[]): number | null {
  return quantile(xs, 0.5);
}

export function quantile(xs: number[], q: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}
