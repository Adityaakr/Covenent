/*
 * The view model every screen renders. Live chain reads and the mock layer both produce a CovenantView, so a screen
 * never knows which one it is looking at except through `source`. Amounts are plain numbers in display units
 * (BNB, tokens, USD); the exact on-chain integers stay in the reader and the transaction builders.
 */

export type Address = `0x${string}`;
export type Hash = `0x${string}`;

/** Vault states from the design doc, plus the launcher's own RAISING and FAILED. */
export type CovenantState = "RAISING" | "FAILED" | "ACTIVE" | "EXIT_ROUND" | "COOLDOWN" | "WIND_DOWN";

export interface Terms {
  name: string;
  symbol: string;
  meta: string;
  totalSupply: number; // tokens
  saleBps: number;
  poolBps: number;
  trancheBps: number[];
  trancheMultiple: number[]; // 200 = 2x the dollar sale price
  minRaise: number; // BNB
  cap: number; // BNB
  saleDuration: number; // seconds
  buyTaxBps: number;
  sellTaxBps: number;
  taxDuration: number; // seconds the trading tax runs after launch; then the treasury grows only from issuer revenue
  teamWallet: Address;
  tapUsdPer30d: number;
  tapCapBps: number;
  cliff: number; // seconds
  unlockWindow: number; // seconds
  exitStreak: number; // seconds of trusted time below book
  roundLength: number;
  cooldown: number;
  exitFeeBps: number;
  heartbeat: number; // seconds
  agentId: number; // 0 = human team (agent layer, optional contract field)
}

export interface Tranche {
  bps: number;
  multiple: number; // 200 = 2x
  progress: number; // seconds counted toward the unlock window
  unlocked: boolean;
  bestRun?: number; // longest counted run so far, when known
}

/** Ledger kinds. `revenue` is income the issuer (agent or team) routes to the vault, kept apart from trading tax. */
export type LedgerKind = "raise" | "tax" | "revenue" | "tap" | "redeem";

export interface LedgerRow {
  kind: LedgerKind;
  at: number; // unix seconds
  amount: number; // BNB, positive in, negative out
  tx?: Hash;
  note: string;
}

export interface PricePoint {
  t: number; // unix seconds
  price: number; // pool TWAP, BNB per token
  book: number; // book value, BNB per token
}

export interface Band {
  from: number;
  to: number;
  kind: "round" | "cooldown";
}

/** One check of a trust gate, shown row by row in the trust panel. */
export interface GateCheck {
  label: string;
  pass: boolean | null; // null = not applicable / not configured
  detail: string;
}

export interface TrustView {
  lastPoke: number | null;
  atlasReportAge: number | null; // seconds, at the last poke
  bnbUsd: number;
  /** Holder-side gate for the exit streak: on-chain numbers only (fixes 2 and 3). */
  exitGate: GateCheck[];
  /** Team-side gate for unlock counters and the dollar tap. Depth and Atlas checks live here only. */
  strictGate: GateCheck[];
  poolOnlyMode: boolean;
}

export type OutcomeKind = "active" | "unlocked" | "wound-down" | "abandoned" | "failed";

export interface IssuerOutcome {
  covenant: string; // symbol or address
  outcome: OutcomeKind;
  at: number;
  detail: string;
  vault?: Address;
}

export interface Issuer {
  kind: "agent" | "human";
  teamWallet: Address;
  agentId?: number;
  name?: string;
  registrationUri?: string;
  registry?: Address;
  services?: { name: string; endpoint: string }[];
  supportedTrust?: string[];
  outcomes: IssuerOutcome[];
  /** The issuer agent loop's last action, when the agent reports one. */
  lastAction?: { at: number; what: string };
}

export interface FeedEvent {
  at: number;
  name: string; // contract event name
  detail: string;
  tx?: Hash;
}

export interface Position {
  committed: number; // BNB
  accepted: number;
  refund: number;
  allocation: number; // tokens
  tokensClaimed: boolean;
  refundClaimed: boolean;
  balance: number; // tokens in wallet
}

export interface CovenantView {
  id: string;
  source: "live" | "mock";
  chainId: number;
  launcher: Address;
  vault?: Address;
  token?: Address;
  pair?: Address;
  oracle?: Address;
  launchBlock?: number;
  state: CovenantState;
  terms: Terms;
  issuer: Issuer;
  raise: {
    committed: number;
    contributors: number;
    deadline: number;
    finalized: boolean;
    launchedAt?: number;
  };
  treasury: number; // BNB balance held by the vault
  owedTeam: number;
  deadTokens: number;
  lockedTeam: number;
  poolPrice: number; // last TWAP, BNB per token
  poolBnb: number; // BNB reserve in the pair
  poolSeedBnb: number; // BNB the pool was seeded with
  tap: {
    accrued: number; // BNB claimable now
    claimedThisPeriod: number;
    lastClaim: number | null;
    /** The vault's own cap for 30 days (tapCapPer30d(): free treasury x cap bps), when read from the chain. */
    capPer30d?: number;
  };
  tranches: Tranche[];
  exit: {
    streak: number; // seconds counted toward terms.exitStreak (decaying counter)
    roundEndsAt: number | null;
    cooldownEndsAt: number | null;
  };
  lastHeartbeat: number;
  disclosure: { passed: number; due: number; nextDueAt: number | null; lastUri?: string };
  trust: TrustView;
  ledger: LedgerRow[];
  history: PricePoint[];
  bands: Band[];
  events: FeedEvent[];
  position?: Position;
  /** the vault's freshBnbUsd(): the last verified BNB/USD if it is still fresh, else 0 (tap paused); null when unknown */
  freshBnbUsd?: number | null;
  /** when Flap's tax token stops charging tax (launch + taxDuration), unix seconds; null before launch or unknown */
  taxEndsAt?: number | null;
  /** who ended the covenant, from the vault's windDownCause/windDownBy (null when it has not ended or the vault predates it) */
  windDown?: { cause: "team" | "guardian" | "abandoned"; by: Address } | null;
  now: number; // the clock the view was computed at (chain time for live, scene time for mock)
}
