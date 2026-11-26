/**
 * Typed response schemas for the Covenant server API (:8787), the MCP tools and the simulator
 * output. The web app mirrors these. Conventions:
 *  - `*Wei` fields are base-10 integer strings (no float loss). Per-token prices (book value, pool
 *    price, TWAP) are BNB per whole token scaled by 1e18, i.e. wei per 1e18 token units.
 *  - Matching `*Bnb` / `*Usd` fields are JavaScript numbers for display only.
 *  - `null` means the value could not be read (the view is not in the deployed ABI, or the data
 *    source is unavailable). The sheet's `reads.missing` lists which views were absent.
 */
import { z } from 'zod';

type HexStr = `0x${string}`;
export const Address = z.string().regex(/^0x[0-9a-fA-F]{40}$/) as unknown as z.ZodType<HexStr>;
export const Hex = z.string().regex(/^0x[0-9a-fA-F]*$/) as unknown as z.ZodType<HexStr>;
export const Wei = z.string().regex(/^-?\d+$/);

export const CovenantState = z.enum(['RAISING', 'FAILED', 'ACTIVE', 'EXIT_ROUND', 'COOLDOWN', 'WIND_DOWN', 'UNKNOWN']);
export type CovenantState = z.infer<typeof CovenantState>;
/** Solidity enum order from docs/DESIGN.md "States". */
export const STATE_ORDER: CovenantState[] = ['RAISING', 'FAILED', 'ACTIVE', 'EXIT_ROUND', 'COOLDOWN', 'WIND_DOWN'];

export const LauncherState = z.enum(['RAISING', 'FAILED', 'LAUNCHED', 'UNKNOWN']);

export const CovenantSummary = z.object({
  vault: Address,
  launcher: Address.nullable(),
  token: Address.nullable(),
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  state: CovenantState,
  treasuryWei: Wei,
  treasuryBnb: z.number(),
  treasuryUsd: z.number().nullable(),
  bookValueWei: Wei.nullable(),
  bookValueBnb: z.number().nullable(),
  poolPriceWei: Wei.nullable(),
  poolPriceBnb: z.number().nullable(),
  /** (pool price / book value - 1) * 100. Negative = trading below book. */
  premiumToBookPct: z.number().nullable(),
  bnbUsd: z.number().nullable(),
  agentId: z.string().nullable(),
});
export type CovenantSummary = z.infer<typeof CovenantSummary>;

export const ExitStatus = z.object({
  /**
   * Fixed exit rule (Captain's review): the streak is trusted-or-not time below book that
   * DECAYS by the elapsed time when an observation is at or above book, instead of resetting,
   * and it is computed from on-chain numbers only (no Atlas, no pool-depth gate).
   */
  rule: z.literal('decaying-streak-onchain'),
  streakSeconds: z.number().nullable(),
  targetSeconds: z.number().nullable(),
  progress: z.number().nullable(),
  /** seconds until the round would open if the price stays below book, null when not applicable */
  etaSeconds: z.number().nullable(),
  open: z.boolean(),
  roundEndsAt: z.number().nullable(),
  cooldownEndsAt: z.number().nullable(),
  exitFeeBps: z.number().nullable(),
  /** ExitRoundOpened events seen so far */
  roundsOpened: z.number(),
});

export const TapStatus = z.object({
  accruedWei: Wei.nullable(),
  accruedBnb: z.number().nullable(),
  tapUsdPer30d: z.number().nullable(),
  capBps: z.number().nullable(),
  /** cap applied to current treasury for a 30-day window */
  capPer30dWei: Wei.nullable(),
  totalPaidWei: Wei.nullable(),
  paused: z.boolean(),
});

export const Tranche = z.object({
  index: z.number(),
  multiple: z.number().nullable(), // 2 = 2x sale price in dollars
  amountWei: Wei.nullable(),
  progressSeconds: z.number().nullable(),
  windowSeconds: z.number().nullable(),
  unlocked: z.boolean().nullable(),
});

export const HeartbeatStatus = z.object({
  lastAt: z.number().nullable(),
  windowSeconds: z.number().nullable(),
  ageSeconds: z.number().nullable(),
  dueAt: z.number().nullable(),
  abandonable: z.boolean(),
});

export const Ledger = z.object({
  raisedWei: Wei,
  taxInWei: Wei,
  tapOutWei: Wei,
  redeemedOutWei: Wei,
});

export const IssuerInfo = z.object({
  teamWallet: Address.nullable(),
  agentId: z.string().nullable(),
  identityRegistry: Address.nullable(),
  registrationUri: z.string().nullable(),
  ownerMatchesTeam: z.boolean().nullable(),
  reputation: z
    .object({ count: z.string(), summaryValue: z.string(), decimals: z.number(), clientFilter: z.array(Address) })
    .nullable(),
});
export type IssuerInfo = z.infer<typeof IssuerInfo>;

export const CovenantSheet = CovenantSummary.extend({
  chainId: z.number(),
  blockNumber: z.string(),
  readAt: z.number(),
  totalSupplyWei: Wei.nullable(),
  redeemableSupplyWei: Wei.nullable(),
  lockedTeamWei: Wei.nullable(),
  owedTeamWei: Wei.nullable(),
  salePriceWei: Wei.nullable(),
  /** book value / sale price */
  floorShareOfSale: z.number().nullable(),
  /** fixed at creation (only the tap can be lowered) */
  terms: z.object({
    exitStreakSeconds: z.number().nullable(),
    roundLengthSeconds: z.number().nullable(),
    cooldownSeconds: z.number().nullable(),
    exitFeeBps: z.number().nullable(),
    heartbeatSeconds: z.number().nullable(),
    tapUsdPer30d: z.number().nullable(),
    tapCapBps: z.number().nullable(),
    unlockWindowSeconds: z.number().nullable(),
  }),
  exit: ExitStatus,
  tap: TapStatus,
  tranches: z.array(Tranche),
  heartbeat: HeartbeatStatus,
  trust: z.object({ lastObservedAt: z.number().nullable(), lastTrusted: z.boolean().nullable(), lastStrict: z.boolean().nullable() }),
  pool: z.object({ pair: Address.nullable(), reserveBnbWei: Wei.nullable(), reserveTokenWei: Wei.nullable() }),
  ledger: Ledger,
  issuer: IssuerInfo,
  launcherInfo: z
    .object({
      state: LauncherState,
      committedWei: Wei.nullable(),
      minRaiseWei: Wei.nullable(),
      capWei: Wei.nullable(),
      deadline: z.number().nullable(),
    })
    .nullable(),
  reads: z.object({ missing: z.array(z.string()), abiSource: z.array(z.string()) }),
});
export type CovenantSheet = z.infer<typeof CovenantSheet>;

export const EventKind = z.enum(['raise', 'tax', 'tap', 'redeem', 'state', 'observation', 'team', 'other']);
export const LedgerEvent = z.object({
  contract: z.enum(['vault', 'launcher']),
  event: z.string(),
  kind: EventKind,
  blockNumber: z.string(),
  txHash: Hex,
  logIndex: z.number(),
  timestamp: z.number().nullable(),
  amountWei: Wei.nullable(),
  args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type LedgerEvent = z.infer<typeof LedgerEvent>;

export const HistoryPoint = z.object({
  timestamp: z.number().nullable(),
  blockNumber: z.string(),
  twapBnb: z.number(),
  bookValueBnb: z.number(),
  bnbUsd: z.number().nullable(),
  trusted: z.boolean(),
  state: CovenantState,
});
export const History = z.object({
  vault: Address,
  points: z.array(HistoryPoint),
  /** exit rounds as [openedAt, closedAt|null] from ExitRoundOpened / ExitRoundClosed */
  rounds: z.array(z.object({ openedAt: z.number().nullable(), endsAt: z.number().nullable(), closedAt: z.number().nullable() })),
});
export type History = z.infer<typeof History>;

const UnsignedTxBase = z.object({
  chainId: z.number(),
  to: Address,
  data: Hex,
  value: Wei,
  /** the account expected to sign, when the call is restricted (team wallet) */
  from: Address.nullable(),
  functionName: z.string(),
  description: z.string(),
});
export const UnsignedTx = UnsignedTxBase.extend({
  /** steps the signer needs first, e.g. a token approval before redeem */
  prerequisites: z.array(UnsignedTxBase),
});
export type UnsignedTx = z.infer<typeof UnsignedTx>;

export const PokeReport = z.object({
  mode: z.enum(['atlas', 'local-test-signer']),
  feedId: z.string(),
  bnbUsd: z.string(),
  timestamp: z.number(),
  signer: Address,
  extraData: Hex,
  note: z.string(),
  /** ready-to-send poke(vault) call with the report appended, when vault and oracle are known */
  tx: UnsignedTx.nullable(),
});
export type PokeReport = z.infer<typeof PokeReport>;

export const Downside = z.object({
  vault: Address,
  holder: Address.nullable(),
  tokensWei: Wei,
  bookValueWei: Wei.nullable(),
  /** what the position redeems for at book today, after the exit fee (fee is 0 at wind-down) */
  redeemNowWei: Wei.nullable(),
  redeemNowBnb: z.number().nullable(),
  /** what selling the same tokens into the pool would pay, before tax (constant product quote) */
  sellOnPoolWei: Wei.nullable(),
  sellOnPoolBnb: z.number().nullable(),
  floorShareOfSale: z.number().nullable(),
  redeemableNow: z.boolean(),
  /** months of runway at the tap cap if no tax arrives and nobody redeems */
  runwayMonthsAtCap: z.number().nullable(),
  /** floor as a share of sale price after N months at the cap (0, 6, 12, 24) */
  floorPath: z.array(z.object({ months: z.number(), floorShareOfSale: z.number().nullable() })),
  explanation: z.string(),
});
export type Downside = z.infer<typeof Downside>;

export const Alert = z.object({
  id: z.string(),
  kind: z.enum(['exit-streak-building', 'exit-round-open', 'heartbeat-due', 'abandonable', 'poke-failed', 'tax-dispatched']),
  vault: Address,
  at: z.number(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type Alert = z.infer<typeof Alert>;

export const SimVariant = z.object({
  rule: z.enum(['reset', 'decay', 'twap72']),
  description: z.string(),
  triggered: z.number(),
  triggeredShare: z.number().nullable(),
  medianDaysToTrigger: z.number().nullable(),
  p25DaysToTrigger: z.number().nullable(),
  p75DaysToTrigger: z.number().nullable(),
  /** treasury left as a share of the accepted raise when the round would have opened (median) */
  medianRedeemableShareOfRaise: z.number().nullable(),
  /** book value / pool price at trigger: what redeeming pays relative to selling (median) */
  medianRedeemVsMarket: z.number().nullable(),
});

export const SimToken = z.object({
  token: Address,
  pair: Address,
  symbol: z.string().nullable(),
  createdAt: z.number().nullable(),
  days: z.number(),
  openPrice: z.number(),
  minPriceShareOfOpen: z.number(),
  lastPriceShareOfOpen: z.number(),
  triggers: z.record(z.string(), z.object({ day: z.number(), price: z.number(), floor: z.number() }).nullable()),
});

export const SimulatorResult = z.object({
  schemaVersion: z.literal(1),
  /** true only when every number below was computed from fetched market data */
  computedFromRealData: z.boolean(),
  generatedAt: z.string(),
  source: z.object({
    sample: z.string(),
    candles: z.string(),
    notes: z.array(z.string()),
  }),
  terms: z.object({
    floorShareOfOpen: z.number(),
    tapCapBpsPer30d: z.number(),
    exitStreakDays: z.number(),
    priceProxy: z.string(),
  }),
  sample: z.object({ requested: z.number(), withCandles: z.number(), minDays: z.number(), windowStart: z.string().nullable(), windowEnd: z.string().nullable() }),
  headline: z.object({ text: z.string().nullable(), rule: z.string(), value: z.number().nullable(), reason: z.string().nullable() }),
  variants: z.array(SimVariant),
  tokens: z.array(SimToken),
});
export type SimulatorResult = z.infer<typeof SimulatorResult>;

export const Health = z.object({
  ok: z.boolean(),
  chainId: z.number(),
  rpcUrl: z.string(),
  blockNumber: z.string().nullable(),
  deploymentsLoaded: z.boolean(),
  abiSource: z.array(z.string()),
  covenants: z.number(),
  oracle: Address.nullable(),
  atlasMode: z.enum(['atlas', 'local-test-signer']),
  cmcKey: z.boolean(),
  simulator: z.boolean(),
});
export type Health = z.infer<typeof Health>;

export const ApiError = z.object({ error: z.string(), detail: z.string().optional() });
