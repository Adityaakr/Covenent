"use client";

/*
 * Covenant Lite on Four.meme: the OpenFour tax-vault template (contracts/src/openfour/CovenantLiteVault.sol) that a
 * Four.meme tax token's ForwardVault clones as the founder's recipient. This prepares what the founder pastes on
 * Four.meme's create page: the template address the deployment names (`liteVaultTemplate`) and the template's
 * initParams, abi.encode(uint16 tapBps, uint32 tapPeriod, uint32 heartbeat, uint16 redeemFeeBps). Bounds are the
 * template's own (MAX_TAP_BPS, MIN/MAX_TAP_PERIOD, MIN/MAX_HEARTBEAT, MAX_REDEEM_FEE_BPS). Thin and read-only: when
 * the integration branch's prepare endpoint lands, this hook is the one place to point at it.
 */
import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { addressOf } from "@/lib/chain/deployment";
import type { Address } from "@/lib/covenant/types";
import { useSource } from "./hooks";

export interface LiteParams { tapBps: number; tapPeriod: number; heartbeat: number; redeemFeeBps: number }

const DAY = 86_400;
export const LITE_DEFAULTS: LiteParams = { tapBps: 400, tapPeriod: 30 * DAY, heartbeat: 45 * DAY, redeemFeeBps: 100 };
export const LITE_BOUNDS = { tapBps: [1, 5_000], tapPeriod: [DAY, 90 * DAY], heartbeat: [7 * DAY, 180 * DAY], redeemFeeBps: [0, 300] } as const;

export function liteProblems(p: LiteParams): string[] {
  const out: string[] = [];
  const within = (v: number, [lo, hi]: readonly [number, number]) => Number.isFinite(v) && v >= lo && v <= hi;
  if (!within(p.tapBps, LITE_BOUNDS.tapBps)) out.push("The budget must be 0.01% to 50% of the treasury per period");
  if (!within(p.tapPeriod, LITE_BOUNDS.tapPeriod)) out.push("The period must be 1 to 90 days");
  if (!within(p.heartbeat, LITE_BOUNDS.heartbeat)) out.push("The heartbeat window must be 7 to 180 days");
  if (!within(p.redeemFeeBps, LITE_BOUNDS.redeemFeeBps)) out.push("The redeem fee must be at most 3%");
  return out;
}

export function encodeLiteParams(p: LiteParams): Hex {
  return encodeAbiParameters(parseAbiParameters("uint16, uint32, uint32, uint16"), [Math.round(p.tapBps), Math.round(p.tapPeriod), Math.round(p.heartbeat), Math.round(p.redeemFeeBps)]);
}

/** The template address from the live deployment (or nothing when the chain is not connected) and the encoded params. */
export function usePrepareFour(p: LiteParams): { template?: Address; chainId?: number; initParams?: Hex; problems: string[]; live: boolean } {
  const src = useSource();
  const problems = liteProblems(p);
  const d = src.payload?.deployment;
  return {
    template: d ? addressOf(d, "liteVaultTemplate", "covenantLiteVault", "covenantLiteTemplate") : undefined,
    chainId: src.chainId,
    initParams: problems.length ? undefined : encodeLiteParams(p),
    problems,
    live: src.mode === "live",
  };
}
