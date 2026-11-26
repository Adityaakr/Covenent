/*
 * Live reads: one launcher, its vault, token and pair, turned into the same CovenantView the mock layer produces.
 * Function names follow docs/DESIGN.md "Smart contract specification"; every call is skipped when the loaded ABI
 * does not have it, so a renamed or missing view degrades one figure instead of the whole sheet.
 */
import { formatEther, type Abi, type PublicClient } from "viem";
import { DEFAULT_TERMS } from "@/lib/covenant/defaults";
import { redeemableSupply, settleRaise, split } from "@/lib/covenant/math";
import type { Address, CovenantState, CovenantView, FeedEvent, Hash, LedgerRow, PricePoint, Terms, Tranche } from "@/lib/covenant/types";
import { abiFor, addressOf, hasFn, pickFn, type DeploymentPayload } from "./deployment";

const DEAD: Address = "0x000000000000000000000000000000000000dEaD";
const ERC20: Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
];
const PAIR: Abi = [
  { type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];

/** Shared enum order from the doc's state table. The launcher's LAUNCHED (if it has one) defers to the vault. */
const STATES: CovenantState[] = ["RAISING", "FAILED", "ACTIVE", "EXIT_ROUND", "COOLDOWN", "WIND_DOWN"];
const VAULT_ONLY: CovenantState[] = ["ACTIVE", "EXIT_ROUND", "COOLDOWN", "WIND_DOWN"];

const eth = (v: unknown) => (typeof v === "bigint" ? Number(formatEther(v)) : 0);
const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : typeof v === "number" ? v : 0);

export interface ReadContext {
  client: PublicClient;
  payload: DeploymentPayload;
  account?: Address;
}

async function call<T = unknown>(ctx: ReadContext, address: Address | undefined, abi: Abi | undefined, name: string | undefined, args: unknown[] = []): Promise<T | undefined> {
  if (!address || !abi || !name || !hasFn(abi, name)) return undefined;
  try {
    return (await ctx.client.readContract({ address, abi, functionName: name, args })) as T;
  } catch {
    return undefined;
  }
}

function termsFrom(raw: unknown): Terms {
  const t = (raw ?? {}) as Record<string, unknown>;
  const g = (k: string) => t[k];
  const arr = (k: string) => (Array.isArray(g(k)) ? (g(k) as unknown[]).map(num) : undefined);
  return {
    ...DEFAULT_TERMS,
    name: typeof g("name") === "string" ? (g("name") as string) : DEFAULT_TERMS.name,
    symbol: typeof g("symbol") === "string" ? (g("symbol") as string) : DEFAULT_TERMS.symbol,
    meta: typeof g("meta") === "string" ? (g("meta") as string) : "",
    totalSupply: g("totalSupply") !== undefined ? eth(g("totalSupply")) : DEFAULT_TERMS.totalSupply,
    saleBps: num(g("saleBps")) || DEFAULT_TERMS.saleBps,
    poolBps: num(g("poolBps")) || DEFAULT_TERMS.poolBps,
    trancheBps: arr("trancheBps") ?? DEFAULT_TERMS.trancheBps,
    trancheMultiple: arr("trancheMultiple") ?? DEFAULT_TERMS.trancheMultiple,
    minRaise: g("minRaise") !== undefined ? eth(g("minRaise")) : DEFAULT_TERMS.minRaise,
    cap: g("cap") !== undefined ? eth(g("cap")) : DEFAULT_TERMS.cap,
    saleDuration: num(g("saleDuration")) || DEFAULT_TERMS.saleDuration,
    buyTaxBps: num(g("buyTaxBps")),
    sellTaxBps: num(g("sellTaxBps")),
    teamWallet: (g("teamWallet") as Address) ?? DEFAULT_TERMS.teamWallet,
    tapUsdPer30d: g("tapUsdPer30d") !== undefined ? eth(g("tapUsdPer30d")) : DEFAULT_TERMS.tapUsdPer30d,
    tapCapBps: num(g("tapCapBps")) || DEFAULT_TERMS.tapCapBps,
    cliff: num(g("cliff")),
    unlockWindow: num(g("unlockWindow")) || DEFAULT_TERMS.unlockWindow,
    exitStreak: num(g("exitStreak")) || DEFAULT_TERMS.exitStreak,
    roundLength: num(g("roundLength")) || DEFAULT_TERMS.roundLength,
    cooldown: num(g("cooldown")) || DEFAULT_TERMS.cooldown,
    exitFeeBps: num(g("exitFeeBps")),
    heartbeat: num(g("heartbeat")) || DEFAULT_TERMS.heartbeat,
    agentId: num(g("agentId")),
  };
}

export async function readCovenant(ctx: ReadContext, launcher: Address): Promise<CovenantView> {
  const { payload, client, account } = ctx;
  const d = payload.deployment!;
  const L = abiFor(payload.abis, "CovenantLauncher", "Launcher");
  const V = abiFor(payload.abis, "CovenantVault", "Vault");
  const O = abiFor(payload.abis, "CovenantOracle", "Oracle");
  const block = await client.getBlock();
  const now = Number(block.timestamp);

  const [termsRaw, lStateRaw, committedRaw, deadlineRaw, tokenRaw, vaultRaw] = await Promise.all([
    call(ctx, launcher, L, pickFn(L, "terms", "getTerms")),
    call(ctx, launcher, L, "state"),
    call(ctx, launcher, L, pickFn(L, "committed", "totalCommitted")),
    call(ctx, launcher, L, pickFn(L, "saleDeadline", "deadline", "saleEnd", "endsAt")),
    call<Address>(ctx, launcher, L, "token"),
    call<Address>(ctx, launcher, L, "vault"),
  ]);
  const terms = termsFrom(termsRaw);
  const zero = (a?: Address) => !a || /^0x0{40}$/i.test(a);
  const vault = zero(vaultRaw) ? undefined : vaultRaw;
  const token = zero(tokenRaw) ? undefined : tokenRaw;
  const lState = num(lStateRaw);

  let state: CovenantState = STATES[lState] ?? "RAISING";
  const sp = split(terms.totalSupply, terms.saleBps, terms.poolBps);
  const committed = eth(committedRaw);
  const r = settleRaise(committed, terms.minRaise, terms.cap, sp);

  // Vault side
  const [vStateRaw, bookRaw, rRaw, streakRaw, tapRaw, hbRaw, owedRaw, lockedRaw, roundEndRaw, cooldownEndRaw, pairRaw] = await Promise.all([
    call(ctx, vault, V, "state"),
    call(ctx, vault, V, "bookValue"),
    call(ctx, vault, V, "redeemableSupply"),
    call(ctx, vault, V, "exitStreak"),
    call(ctx, vault, V, pickFn(V, "tapAccrued", "owedTeam")),
    call(ctx, vault, V, pickFn(V, "lastHeartbeat", "heartbeatAt")),
    call(ctx, vault, V, pickFn(V, "owedTeam", "tapAccrued")),
    call(ctx, vault, V, pickFn(V, "lockedTeam", "lockedTeamTokens")),
    call(ctx, vault, V, pickFn(V, "roundEnd", "roundEndsAt", "exitRoundEnd")),
    call(ctx, vault, V, pickFn(V, "cooldownEnd", "cooldownEndsAt")),
    call<Address>(ctx, vault, V, pickFn(V, "pair", "pool")),
  ]);
  if (vault && vStateRaw !== undefined) {
    const s = num(vStateRaw);
    state = (s < STATES.length && STATES[s] && s >= 2 ? STATES[s] : VAULT_ONLY[s]) ?? state;
  }
  const treasury = vault ? eth(await client.getBalance({ address: vault })) : 0;
  const pair = zero(pairRaw) ? addressOf(d, "pair", "pool") : pairRaw;
  const [deadRaw, balRaw] = await Promise.all([call(ctx, token, ERC20, "balanceOf", [DEAD]), account ? call(ctx, token, ERC20, "balanceOf", [account]) : undefined]);
  const deadTokens = eth(deadRaw);
  const lockedTeam = lockedRaw !== undefined ? eth(lockedRaw) : sp.E;
  const owedTeam = eth(owedRaw);
  void (rRaw ?? redeemableSupply(terms.totalSupply, deadTokens, lockedTeam));

  // Pool price from reserves
  let poolPrice = 0, poolBnb = 0;
  if (pair && token) {
    const [res, t0] = await Promise.all([call<readonly bigint[]>(ctx, pair, PAIR, "getReserves"), call<Address>(ctx, pair, PAIR, "token0")]);
    if (res && t0) {
      const tokIs0 = t0.toLowerCase() === token.toLowerCase();
      const tokRes = eth(tokIs0 ? res[0] : res[1]);
      poolBnb = eth(tokIs0 ? res[1] : res[0]);
      poolPrice = tokRes > 0 ? poolBnb / tokRes : 0;
    }
  }

  const tranches: Tranche[] = await Promise.all(terms.trancheBps.map(async (bps, k) => {
    const p = await call(ctx, vault, V, "trancheProgress", [BigInt(k)]);
    // real vault: (amount, multiple x100, progress seconds, unlocked, targetUsd); older shape: (progress, unlocked)
    const tuple = Array.isArray(p) ? p : null;
    const full = tuple !== null && tuple.length >= 4;
    const progress = tuple ? num(full ? tuple[2] : tuple[0]) : num(p);
    return { bps, multiple: terms.trancheMultiple[k] ?? 0, progress, unlocked: tuple ? Boolean(full ? tuple[3] : tuple[1]) : false };
  }));

  // Position
  let position: CovenantView["position"];
  if (account) {
    const [c, acc, alloc, claimedRaw, refundedRaw] = await Promise.all([
      call(ctx, launcher, L, pickFn(L, "contributions", "contributionOf", "committedOf"), [account]),
      call(ctx, launcher, L, "acceptedOf", [account]),
      call(ctx, launcher, L, "allocationOf", [account]),
      call<boolean>(ctx, vault, V, "tokensClaimed", [account]),
      call<boolean>(ctx, launcher, L, "refunded", [account]),
    ]);
    const cBnb = eth(c);
    const accBnb = acc !== undefined ? eth(acc) : r.failed ? 0 : (cBnb * r.Q) / Math.max(committed, 1e-18);
    position = { committed: cBnb, accepted: accBnb, refund: Math.max(0, cBnb - accBnb), allocation: alloc !== undefined ? eth(alloc) : 0, tokensClaimed: claimedRaw === true, refundClaimed: refundedRaw === true, balance: eth(balRaw) };
  }

  // Events: ledger, feed and the price-against-book history from Observed
  const ledger: LedgerRow[] = [];
  const events: FeedEvent[] = [];
  const history: PricePoint[] = [];
  const deposited = new Set<string>();
  // ERC-8004 outcomes this vault wrote to the agent's reputation record (OutcomeRecorded mirrors giveFeedback)
  const outcomes: CovenantView["issuer"]["outcomes"] = [];
  const fromBlock = BigInt(d.startBlock ?? 0);
  const tsCache = new Map<bigint, number>();
  const ts = async (bn: bigint) => { if (!tsCache.has(bn)) tsCache.set(bn, Number((await client.getBlock({ blockNumber: bn })).timestamp)); return tsCache.get(bn)!; };
  try {
    const logs = await Promise.all([
      L ? client.getContractEvents({ address: launcher, abi: L, fromBlock }) : [],
      vault && V ? client.getContractEvents({ address: vault, abi: V, fromBlock }) : [],
    ]);
    for (const log of logs.flat()) {
      const l = log as unknown as { eventName: string; args: Record<string, unknown>; blockNumber: bigint; transactionHash: Hash };
      const at = await ts(l.blockNumber);
      const a = l.args ?? {};
      const amount = (...k: string[]) => { for (const kk of k) if (a[kk] !== undefined) return eth(a[kk]); return 0; };
      switch (l.eventName) {
        case "TreasuryFunded": ledger.push({ kind: "raise", at, amount: amount("amount", "value", "treasury"), tx: l.transactionHash, note: "Treasury share of the raise" }); break;
        // Every BNB arrival is recognised by balance delta; RevenueDeposited marks the ones the issuer sent on purpose.
        case "RevenueRecognized": ledger.push({ kind: "tax", at, amount: amount("amount", "value"), tx: l.transactionHash, note: "Trading tax dispatched to the vault" }); break;
        case "RevenueDeposited": deposited.add(l.transactionHash); break;
        case "TapClaimed": ledger.push({ kind: "tap", at, amount: -amount("amount", "value"), tx: l.transactionHash, note: "Tap claimed by the team wallet" }); break;
        case "Redeemed": ledger.push({ kind: "redeem", at, amount: -amount("bnbOut", "out", "amountOut"), tx: l.transactionHash, note: `${(amount("tokens", "got", "amount") / 1e6).toFixed(2)}M tokens burned at book` }); break;
        case "OutcomeRecorded": {
          const kind = String(a.outcome ?? "");
          outcomes.push({
            covenant: terms.symbol, vault, at,
            outcome: (["abandoned", "wound-down", "unlocked", "failed"].includes(kind) ? kind : "active") as CovenantView["issuer"]["outcomes"][number]["outcome"],
            detail: `value ${String(a.value ?? "")}${a.ok === false ? " · registry refused, kept on the vault" : " · written to ERC-8004"}`,
          });
          break;
        }
        case "Observed": history.push({ t: at, price: amount("twapBnb", "twap", "price"), book: amount("bookValue", "book") }); break;
      }
      events.push({ at, name: l.eventName, detail: Object.entries(a).slice(0, 3).map(([k, v]) => `${k} ${typeof v === "bigint" ? (v > 10n ** 12n ? Number(formatEther(v)).toLocaleString("en-US", { maximumFractionDigits: 6 }) : v.toString()) : String(v)}`).join(" · "), tx: l.transactionHash });
    }
  } catch {
    /* log queries can fail on a pruned node; the sheet still renders its reads */
  }
  for (const row of ledger) if (row.kind === "tax" && row.tx && deposited.has(row.tx)) { row.kind = "revenue"; row.note = "Issuer revenue routed to the vault"; }
  events.sort((a, b) => b.at - a.at);
  const lastHeartbeat = hbRaw !== undefined ? num(hbRaw) : events.find((e) => ["Heartbeat", "TapClaimed", "TapLowered", "ReportPosted"].includes(e.name))?.at ?? now;
  const lastObs = history.at(-1);

  const view: CovenantView = {
    id: launcher,
    source: "live",
    chainId: d.chainId,
    launcher,
    vault,
    token,
    pair,
    oracle: addressOf(d, "oracle", "covenantOracle"),
    launchBlock: d.startBlock,
    state,
    terms,
    issuer: { kind: terms.agentId > 0 ? "agent" : "human", teamWallet: terms.teamWallet, agentId: terms.agentId || undefined, outcomes },
    raise: { committed, contributors: num(await call(ctx, launcher, L, pickFn(L, "contributorCount", "contributors"))), deadline: num(deadlineRaw), finalized: state !== "RAISING" },
    treasury,
    owedTeam,
    deadTokens,
    lockedTeam,
    poolPrice: lastObs?.price || poolPrice,
    poolBnb,
    poolSeedBnb: r.qPool,
    tap: { accrued: eth(tapRaw), claimedThisPeriod: ledger.filter((x) => x.kind === "tap" && x.at > now - 30 * 86400).reduce((s, x) => s - x.amount, 0), lastClaim: ledger.filter((x) => x.kind === "tap").at(-1)?.at ?? null },
    tranches,
    exit: { streak: num(streakRaw), roundEndsAt: roundEndRaw !== undefined && num(roundEndRaw) > 0 ? num(roundEndRaw) : null, cooldownEndsAt: cooldownEndRaw !== undefined && num(cooldownEndRaw) > 0 ? num(cooldownEndRaw) : null },
    lastHeartbeat,
    disclosure: { passed: events.filter((e) => e.name === "ReportPosted").length, due: 0, nextDueAt: null },
    trust: {
      lastPoke: lastObs?.t ?? null,
      atlasReportAge: null,
      bnbUsd: 0,
      exitGate: [
        { label: "Pool TWAP read from the pair's cumulative price", pass: true, detail: "On-chain" },
        { label: "Book value read from the vault's balance and supply", pass: bookRaw !== undefined, detail: bookRaw !== undefined ? "vault.bookValue()" : "Computed from balance and supply" },
        { label: "No pool-depth requirement", pass: true, detail: "Depth guards team unlocks only" },
        { label: "No Atlas requirement", pass: true, detail: "An Atlas outage never delays the exit" },
      ],
      strictGate: [
        { label: "Atlas BNB/USD report verifies and is fresh", pass: null, detail: O ? "Read from the last Observed event" : "Oracle ABI not loaded" },
        { label: "Pool BNB at least half the launch seed", pass: poolBnb > 0 ? poolBnb >= r.qPool / 2 : null, detail: `${poolBnb.toFixed(2)} of ${(r.qPool / 2).toFixed(2)} BNB` },
      ],
      poolOnlyMode: false,
    },
    ledger: ledger.sort((a, b) => a.at - b.at),
    history,
    bands: [],
    events,
    position,
    now,
  };
  return applyLens(ctx, view);
}

/**
 * The contracts ship CovenantLens: one view call returns the whole status a sheet needs. When the deployment names
 * it, its numbers replace the per-call reads above (same values, one round trip, and the exit streak the vault
 * itself computes with the decaying rule).
 */
async function applyLens(ctx: ReadContext, v: CovenantView): Promise<CovenantView> {
  const d = ctx.payload.deployment!;
  const LENS = abiFor(ctx.payload.abis, "CovenantLens", "Lens");
  const at = addressOf(d, "lens", "covenantLens");
  const st = await call<Record<string, unknown>>(ctx, at, LENS, "status", [v.launcher]);
  if (!st) return v;
  const s = (k: string) => st[k];
  const state = STATES[num(s("state"))] ?? v.state;
  const tranches = Array.isArray(s("tranches")) ? (s("tranches") as Record<string, unknown>[]).map((t, k) => ({
    bps: v.terms.trancheBps[k] ?? 0, multiple: num(t.multiple) || v.terms.trancheMultiple[k] || 0, progress: num(t.progress), unlocked: Boolean(t.unlocked),
  })) : v.tranches;
  const out: CovenantView = {
    ...v,
    state,
    vault: (s("vault") as Address) && !/^0x0{40}$/i.test(String(s("vault"))) ? (s("vault") as Address) : v.vault,
    token: (s("token") as Address) && !/^0x0{40}$/i.test(String(s("token"))) ? (s("token") as Address) : v.token,
    pair: (s("pair") as Address) && !/^0x0{40}$/i.test(String(s("pair"))) ? (s("pair") as Address) : v.pair,
    raise: { ...v.raise, committed: eth(s("committed")), contributors: num(s("contributorCount")), deadline: num(s("saleDeadline")) || v.raise.deadline, finalized: state !== "RAISING" },
    treasury: eth(s("treasury")),
    owedTeam: eth(s("owedTeam")),
    lockedTeam: eth(s("lockedTeam")),
    poolPrice: eth(s("lastTwapBnb")) || eth(s("spotBnb")) || v.poolPrice,
    tap: { ...v.tap, accrued: eth(s("owedTeam")) },
    tranches,
    exit: { streak: num(s("exitStreak")), roundEndsAt: num(s("roundEnd")) > v.now ? num(s("roundEnd")) : null, cooldownEndsAt: num(s("cooldownEnd")) > v.now ? num(s("cooldownEnd")) : null },
    lastHeartbeat: num(s("lastHeartbeat")) || v.lastHeartbeat,
    terms: { ...v.terms, tapUsdPer30d: eth(s("tapUsdPer30d")) || v.terms.tapUsdPer30d, minRaise: eth(s("minRaise")) || v.terms.minRaise, cap: eth(s("cap")) || v.terms.cap, exitStreak: num(s("exitStreakNeeded")) || v.terms.exitStreak, agentId: num(s("agentId")) || v.terms.agentId, teamWallet: (s("teamWallet") as Address) ?? v.terms.teamWallet },
    trust: {
      ...v.trust,
      lastPoke: num(s("lastObservedAt")) || v.trust.lastPoke,
      bnbUsd: eth(s("lastBnbUsd")) || v.trust.bnbUsd,
      exitGate: [
        { label: "Pool TWAP read from the pair's cumulative price", pass: Boolean(s("lastTrusted")), detail: Boolean(s("lastTrusted")) ? "Last observation counted" : "No valid TWAP at the last poke" },
        ...v.trust.exitGate.slice(1),
      ],
      strictGate: [
        { label: "Atlas BNB/USD report verifies and is fresh", pass: Boolean(s("lastAtlas")), detail: Boolean(s("lastAtlas")) ? "Verified rate rode along with the last poke" : "No fresh Atlas rate at the last poke" },
        { label: "Pool BNB at least half the launch seed", pass: Boolean(s("lastDeep")), detail: "Guards unlocks and the dollar tap only" },
        { label: "Disclosure", pass: !s("disclosurePaused"), detail: s("disclosurePaused") ? "A missed report pauses the tap" : "Reports up to date" },
      ],
    },
  };
  // Issuer: ERC-8004 identity and the outcomes this vault has written
  const iss = out.vault ? await call<Record<string, unknown>>(ctx, at, LENS, "issuer", [out.vault]) : undefined;
  if (iss && num(iss.agentId) > 0) {
    out.issuer = {
      ...out.issuer, kind: "agent", agentId: num(iss.agentId), teamWallet: iss.teamWallet as Address,
      registry: iss.identityRegistry as Address, registrationUri: typeof iss.agentURI === "string" && iss.agentURI ? iss.agentURI : undefined,
      lastAction: { at: num(iss.lastHeartbeat), what: Boolean(iss.agentBound) ? "Heartbeat (identity bound to the team wallet)" : "Heartbeat" },
    };
    out.disclosure = { ...out.disclosure, passed: num(iss.reportsPosted) || out.disclosure.passed };
  }
  // Exit-round bands from the event feed
  const opened = out.events.filter((e) => e.name === "ExitRoundOpened").map((e) => e.at).sort((a, b) => a - b);
  out.bands = opened.map((from) => ({ from, to: Math.min(out.now, from + out.terms.roundLength), kind: "round" as const }));
  return out;
}
