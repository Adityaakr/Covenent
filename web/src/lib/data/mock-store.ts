"use client";

/*
 * Client-side state for the mock layer: which demo scene the flagship covenant is in, plus every action a visitor
 * takes on mock data (commit, redeem, claim tap...). Actions run the same formulas as the contracts, so a mock
 * redemption moves book value exactly as the vault would.
 */
import { useSyncExternalStore } from "react";
import { bookValue, redeemQuote, redeemableSupply } from "@/lib/covenant/math";
import { flagshipScene, otherCovenants, type SceneId } from "@/lib/covenant/mock";
import { hexFrom } from "@/lib/covenant/sim";
import type { CovenantView, Hash } from "@/lib/covenant/types";

interface MockState {
  scene: SceneId;
  views: Record<string, CovenantView>;
  version: number;
}

const listeners = new Set<() => void>();
let state: MockState | null = null;
let txn = 9000;

function init(): MockState {
  const views: Record<string, CovenantView> = { lumen: flagshipScene("slide") };
  for (const v of otherCovenants()) views[v.id] = v;
  return { scene: "slide", views, version: 0 };
}

function get(): MockState {
  if (!state) state = init();
  return state;
}

function emit(next: MockState) {
  state = { ...next, version: next.version + 1 };
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useMock(): MockState {
  return useSyncExternalStore(subscribe, get, get);
}

export function setScene(scene: SceneId) {
  const s = get();
  emit({ ...s, scene, views: { ...s.views, lumen: flagshipScene(scene) } });
}

export function resetMock() {
  state = null;
  emit(get());
}

export class MockError extends Error {}

/** Apply one action to one mock covenant and return a fake transaction hash. */
export function mockAct(id: string, action: string, arg?: number): Hash {
  const s = get();
  const v0 = s.views[id];
  if (!v0) throw new MockError("Unknown covenant");
  const v: CovenantView = structuredClone(v0);
  const tx = hexFrom(++txn) as Hash;
  const R = () => redeemableSupply(v.terms.totalSupply, v.deadTokens, v.lockedTeam);
  const ev = (name: string, detail: string) => v.events.unshift({ at: v.now, name, detail, tx });
  const pos = v.position ?? (v.position = { committed: 0, accepted: 0, refund: 0, allocation: 0, tokensClaimed: false, refundClaimed: false, balance: 0 });

  switch (action) {
    case "commit": {
      if (v.state !== "RAISING") throw new MockError("The sale is closed");
      const a = arg ?? 0;
      if (!(a > 0)) throw new MockError("Enter an amount above zero");
      v.raise.committed += a;
      pos.committed += a;
      ev("Contributed", `You committed ${a} BNB`);
      break;
    }
    case "finalize": {
      if (v.state !== "RAISING") throw new MockError("Already finalized");
      if (id === "lumen") { setScene("settled"); return tx; }
      if (v.now < v.raise.deadline) throw new MockError("The sale window is still open");
      break;
    }
    case "claimTokens": {
      if (pos.tokensClaimed || pos.allocation <= 0) throw new MockError("Nothing to claim");
      pos.tokensClaimed = true;
      pos.balance += pos.allocation;
      ev("TokensClaimed", `${(pos.allocation / 1e6).toFixed(2)}M tokens to your wallet`);
      break;
    }
    case "claimRefund": {
      if (pos.refundClaimed || pos.refund <= 0) throw new MockError("No refund due");
      pos.refundClaimed = true;
      ev("Refunded", `${pos.refund.toFixed(4)} BNB refunded`);
      break;
    }
    case "poke": {
      v.trust.lastPoke = v.now;
      ev("Observed", `Pool TWAP ${v.poolPrice.toExponential(3)} BNB against book ${bookValue(v.treasury, v.owedTeam, R()).toExponential(3)} BNB`);
      break;
    }
    case "redeem": {
      if (v.state !== "EXIT_ROUND" && v.state !== "WIND_DOWN") throw new MockError("Redemption opens only in an exit round or at wind-down");
      const amt = arg ?? 0;
      if (!(amt > 0) || amt > pos.balance + 1e-6) throw new MockError("Amount exceeds your balance");
      const b = bookValue(v.treasury, v.owedTeam, R());
      const q = redeemQuote(amt, b, v.terms.exitFeeBps, v.state === "WIND_DOWN");
      v.treasury -= q.out;
      v.deadTokens += amt;
      pos.balance -= amt;
      v.ledger.push({ kind: "redeem", at: v.now, amount: -q.out, tx, note: `${(amt / 1e6).toFixed(2)}M tokens burned at book (you)` });
      ev("Redeemed", `${(amt / 1e6).toFixed(2)}M tokens for ${q.out.toFixed(4)} BNB`);
      break;
    }
    case "claimTap": {
      if (v.state === "WIND_DOWN" && v.owedTeam <= 0) throw new MockError("Nothing accrued");
      const a = v.owedTeam;
      if (a <= 0) throw new MockError("Nothing accrued yet");
      v.treasury -= a;
      v.owedTeam = 0;
      v.tap = { ...v.tap, accrued: 0, claimedThisPeriod: v.tap.claimedThisPeriod + a, lastClaim: v.now };
      v.lastHeartbeat = v.now;
      v.ledger.push({ kind: "tap", at: v.now, amount: -a, tx, note: "Tap claimed by the issuer" });
      ev("TapClaimed", `${a.toFixed(3)} BNB to the team wallet`);
      break;
    }
    case "heartbeat": {
      if (v.state === "WIND_DOWN") throw new MockError("The covenant has wound down");
      v.lastHeartbeat = v.now;
      ev("Heartbeat", "Issuer heartbeat");
      break;
    }
    case "lowerTap": {
      const usd = arg ?? 0;
      if (!(usd >= 0) || usd >= v.terms.tapUsdPer30d) throw new MockError("The tap can only go down");
      ev("TapLowered", `From $${v.terms.tapUsdPer30d.toLocaleString("en-US")} to $${usd.toLocaleString("en-US")} per 30 days`);
      v.terms = { ...v.terms, tapUsdPer30d: usd };
      v.lastHeartbeat = v.now;
      break;
    }
    case "postReport": {
      v.disclosure = { ...v.disclosure, passed: v.disclosure.passed + 1, due: Math.max(v.disclosure.due, v.disclosure.passed + 1) };
      v.lastHeartbeat = v.now;
      ev("ReportPosted", `Period ${v.disclosure.passed} report posted with its hash`);
      break;
    }
    case "revenue": {
      const a = arg ?? 0;
      if (!(a > 0)) throw new MockError("Enter an amount above zero");
      v.treasury += a;
      v.ledger.push({ kind: "revenue", at: v.now, amount: a, tx, note: "Issuer revenue routed to the vault" });
      ev("RevenueRecognized", `${a.toFixed(3)} BNB issuer revenue`);
      break;
    }
    case "windDown":
    case "declareAbandoned": {
      if (v.state === "WIND_DOWN" || v.state === "FAILED" || v.state === "RAISING") throw new MockError("Not available in this state");
      const due = v.now > v.lastHeartbeat + v.terms.heartbeat;
      if (action === "declareAbandoned" && !due) throw new MockError("The heartbeat has not lapsed");
      if (id === "lumen" && action === "declareAbandoned") { setScene("abandoned"); return tx; }
      if (action === "declareAbandoned") { v.owedTeam = 0; v.tap.accrued = 0; }
      v.deadTokens += v.lockedTeam;
      v.lockedTeam = 0;
      v.state = "WIND_DOWN";
      ev("WoundDown", action === "declareAbandoned" ? "Declared abandoned. Locked team tokens burned" : "Issuer closed the covenant");
      break;
    }
    case "releaseTeam": {
      const ready = v.tranches.filter((t) => t.unlocked);
      if (ready.length === 0) throw new MockError("No tranche has unlocked");
      ev("TeamReleased", "Unlocked tranches sent to the team wallet");
      break;
    }
    default:
      throw new MockError(`Unknown action ${action}`);
  }
  emit({ ...s, views: { ...s.views, [id]: v } });
  return tx;
}
