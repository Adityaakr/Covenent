import { BaseError, decodeErrorResult, type Abi, type Address, type Hex, type PublicClient } from 'viem';
import { redactSecrets } from '../safety.js';
import type { Simulation, UnsignedTx } from '../schema.js';

/** Plain-language meaning of the contracts' custom errors (contracts/src/vault, launcher, oracle). */
const ERROR_HINTS: Record<string, string> = {
  SaleClosed: 'the raise is closed (deadline passed or the sale is no longer RAISING)',
  SaleOpen: 'the raise is still open: finalize only after the sale deadline',
  NotRaising: 'the raise was already finalized',
  ZeroContribution: 'the commitment is zero',
  LaunchInProgress: 'the launch is in progress',
  InsufficientGas: 'not enough gas: finalize needs the full 15M gas limit attached (12M left at its check)',
  RefundUnavailable: 'refunds open only after the raise is finalized',
  NothingToRefund: 'this wallet has nothing to refund (nothing unaccepted, or already refunded)',
  NothingToClaim: 'nothing to claim for this wallet (no allocation, already claimed, or nothing accrued)',
  NotLive: 'the vault is not live yet (the raise has not launched)',
  NotRedeemable: 'redemption is open only in EXIT_ROUND or WIND_DOWN',
  ZeroAmount: 'the amount is zero',
  Slippage: 'book value moved: the payout would be below minOut',
  NotTeam: 'only the team wallet can send this',
  NotAbandoned: 'the heartbeat window has not passed yet',
  Ended: 'the covenant is wound down',
  TapNotLower: 'the new tap must be strictly lower than the current one',
  TooSoon: 'the oracle refuses pokes closer together than its minimum interval',
  ReceivedLess: 'the vault received fewer tokens than expected (a token tax applied to the transfer)',
  Reentrancy: 'reentrant call',
};

function revertData(e: unknown): Hex | undefined {
  if (!(e instanceof BaseError)) return undefined;
  let found: Hex | undefined;
  e.walk((x) => {
    const d = (x as { data?: unknown }).data;
    if (typeof d === 'string' && d.startsWith('0x')) found = d as Hex;
    else if (d && typeof d === 'object' && typeof (d as { data?: unknown }).data === 'string') found = (d as { data: Hex }).data;
    return found !== undefined;
  });
  return found;
}

function shortMessage(e: unknown): string {
  const m = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message ?? String(e);
  return redactSecrets(m.split('\n')[0]!).slice(0, 240);
}

/** Every error the Covenant contracts can revert with, for decoding. */
export function errorAbi(...abis: Abi[]): Abi {
  const seen = new Set<string>();
  const out: Abi[number][] = [];
  for (const abi of abis) {
    for (const i of abi) {
      if (i.type !== 'error' || seen.has(i.name)) continue;
      seen.add(i.name);
      out.push(i);
    }
  }
  return out as Abi;
}

/**
 * eth_call the transaction from `from` at the latest block, then estimate gas when it succeeds. A revert comes back
 * decoded (custom error name and args) with a hint; nothing is ever sent.
 */
export async function simulate(
  client: PublicClient,
  tx: Pick<UnsignedTx, 'to' | 'data' | 'value' | 'gas'>,
  opts: { from: Address | null; errors: Abi; pendingPrerequisites?: number },
): Promise<Simulation> {
  let blockNumber: string | null = null;
  try {
    blockNumber = (await client.getBlockNumber({ cacheTime: 0 })).toString();
  } catch {
    /* reported by the call below */
  }
  const req = {
    ...(opts.from ? { account: opts.from } : {}),
    to: tx.to,
    data: tx.data,
    value: BigInt(tx.value),
    ...(tx.gas ? { gas: BigInt(tx.gas) } : {}),
  };
  try {
    await client.call(req);
  } catch (e) {
    const data = revertData(e);
    let error: string | null = null;
    let errorArgs: string[] = [];
    if (data && data.length >= 10) {
      try {
        const d = decodeErrorResult({ abi: opts.errors, data });
        error = d.errorName;
        errorArgs = (d.args ?? []).map((a) => (typeof a === 'bigint' ? a.toString() : String(a)));
      } catch {
        /* unknown selector */
      }
    }
    const reason = error === 'Error' ? errorArgs[0] : error ? (ERROR_HINTS[error] ?? error) : shortMessage(e);
    const pending = opts.pendingPrerequisites
      ? ` It depends on ${opts.pendingPrerequisites} prerequisite transaction(s) that have not been sent yet, so it may succeed once they land; send them first and simulate again with simulate_transaction.`
      : ' Do not send it as is.';
    return {
      ok: false,
      from: opts.from,
      blockNumber,
      gasEstimate: null,
      error: error === 'Error' ? null : error,
      errorArgs: error === 'Error' ? [] : errorArgs,
      note: `Would revert now: ${reason}.${pending}`,
    };
  }
  let gasEstimate: string | null = null;
  try {
    gasEstimate = (await client.estimateGas(req)).toString();
  } catch {
    /* eth_call passed; some nodes refuse estimates for explicit-gas calls */
  }
  return {
    ok: true,
    from: opts.from,
    blockNumber,
    gasEstimate,
    error: null,
    errorArgs: [],
    note: opts.from
      ? `Succeeds now when sent from ${opts.from}. State can change before it lands.`
      : 'Succeeds now from an unspecified sender (pass from to simulate as the real signer). State can change before it lands.',
  };
}

export const NOT_SIMULATED = (note: string, from: Address | null = null): Simulation => ({
  ok: null,
  from,
  blockNumber: null,
  gasEstimate: null,
  error: null,
  errorArgs: [],
  note,
});
