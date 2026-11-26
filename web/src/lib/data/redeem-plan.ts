/**
 * The redemption's transactions: approve exactly `amount` only when the allowance is short (unknown counts as short),
 * then redeem with a floor of 99.5% of the vault's own preview (or the off-chain quote when the vault has none).
 */
export function planRedeem({ amount, allowance, preview, fallbackOut }: { amount: bigint; allowance?: bigint; preview?: bigint; fallbackOut: bigint }): { approve: bigint | null; minOut: bigint } {
  const approve = allowance !== undefined && allowance >= amount ? null : amount;
  const expected = preview !== undefined && preview > 0n ? preview : fallbackOut;
  return { approve, minOut: (expected * 995n) / 1000n };
}
