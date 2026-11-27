/* Test helpers for Covenant AI: a covenant view and a chain context with no network. Imported by *.test.ts only. */
import type { PublicClient } from "viem";
import { TESTNET_PAYLOAD } from "@/lib/chain/target";
import { DEFAULT_TERMS } from "@/lib/covenant/defaults";
import type { Address, CovenantView } from "@/lib/covenant/types";
import type { AiContext } from "./context";

export const ME = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
export const TEAM = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address;
export const LAUNCHER = "0x1111111111111111111111111111111111111111" as Address;
export const VAULT = "0x2222222222222222222222222222222222222222" as Address;
export const TOKEN = "0x3333333333333333333333333333333333333333" as Address;
const NOW = 1_800_000_000;

export function view(over: Partial<CovenantView> = {}): CovenantView {
  return {
    id: LAUNCHER, source: "live", chainId: 97, launcher: LAUNCHER, vault: VAULT, token: TOKEN, oracle: "0x3CC607931edaF307dC867111e48cAc28e31fF052",
    state: "RAISING",
    terms: { ...DEFAULT_TERMS, name: "Scout", symbol: "SCOUT", minRaise: 3, cap: 5, teamWallet: TEAM, saleBps: 5000, poolBps: 4500, trancheBps: [500], trancheMultiple: [200] },
    issuer: { kind: "agent", agentId: 7, teamWallet: TEAM, outcomes: [] },
    raise: { committed: 1, contributors: 2, deadline: NOW + 600, finalized: false },
    treasury: 0, owedTeam: 0, deadTokens: 0, lockedTeam: 50_000_000, poolPrice: 0, poolBnb: 0, poolSeedBnb: 0,
    tap: { accrued: 0, claimedThisPeriod: 0, lastClaim: null }, tranches: [], exit: { streak: 0, roundEndsAt: null, cooldownEndsAt: null },
    lastHeartbeat: NOW, disclosure: { passed: 0, due: 0, nextDueAt: null },
    trust: { lastPoke: null, bnbUsd: 600, bnbUsdAt: null, exitGate: [], strictGate: [], poolOnlyMode: false },
    ledger: [], history: [], bands: [], events: [], now: NOW,
    position: { committed: 0, accepted: 0, refund: 0, allocation: 0, tokensClaimed: false, refundClaimed: false, balance: 0 },
    ...over,
  };
}

export interface FakeChain {
  calls: { method: string; args: unknown }[];
  revert?: string;
  reads?: Record<string, unknown>;
}

/** A context whose client answers eth_call / estimateGas / reads from `chain`, with the baked testnet deployment. */
export function context(views: CovenantView[], chain: FakeChain = { calls: [] }, account: Address | null = ME): AiContext {
  const client = {
    call: async (a: unknown) => { chain.calls.push({ method: "call", args: a }); if (chain.revert) throw new Error(chain.revert); return { data: "0x" }; },
    estimateGas: async (a: unknown) => { chain.calls.push({ method: "estimateGas", args: a }); return 51_234n; },
    readContract: async (a: { functionName: string }) => { chain.calls.push({ method: `read:${a.functionName}`, args: a }); if (chain.reads && a.functionName in chain.reads) return chain.reads[a.functionName]; throw new Error(`no ${a.functionName}`); },
    getBalance: async () => 10n ** 18n,
  } as unknown as PublicClient;
  const ctx: AiContext = {
    client, payload: TESTNET_PAYLOAD, chainId: 97, account: account ?? undefined,
    views: async () => views,
    find: async (ref) => {
      const v = views.find((x) => x.id.toLowerCase() === ref.toLowerCase() || x.terms.symbol.toLowerCase() === ref.toLowerCase());
      if (!v) throw new Error(`No covenant matches "${ref}".`);
      return v;
    },
  };
  return ctx;
}
