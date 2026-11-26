import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BaseError, ContractFunctionRevertedError, encodeErrorResult, parseEther, type Abi, type AbiFunction } from "viem";
import { describe, expect, it } from "vitest";
import { BOUNDS, DEFAULT_TERMS } from "@/lib/covenant/defaults";
import { longSpan } from "@/lib/covenant/time";
import { factoryReason, termsTuple } from "./create";
import { FINALIZE_GAS } from "./gas";
import baked from "@/generated/testnet.json";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../..");
const factoryAbi = (baked as unknown as { abis: Record<string, Abi> }).abis.CovenantLauncherFactory!;

// Flap audit flag 2: the app sends finalize() with an explicit limit, the launcher's own FINALIZE_GAS_LIMIT.
describe("finalize gas", () => {
  it("matches the launcher contract, clears its 12M guard and stays within Flap's 15M gas cap", () => {
    const sol = readFileSync(path.join(repo, "contracts/src/launcher/CovenantLauncher.sol"), "utf8");
    const limit = BigInt(sol.match(/FINALIZE_GAS_LIMIT = ([\d_]+);/)![1]!.replaceAll("_", ""));
    const floor = BigInt(sol.match(/LAUNCH_GAS_FLOOR = ([\d_]+);/)![1]!.replaceAll("_", ""));
    expect(FINALIZE_GAS).toBe(limit);
    expect(FINALIZE_GAS).toBeGreaterThanOrEqual(floor + 2_500_000n);
    expect(FINALIZE_GAS).toBeLessThanOrEqual(15_000_000n);
  });
  it("the finalize action passes it to the wallet", () => {
    const src = readFileSync(path.join(repo, "web/src/lib/data/actions.ts"), "utf8");
    const block = src.slice(src.indexOf('case "finalize"'), src.indexOf('case "claimRefund"'));
    expect(block).toContain("gas: FINALIZE_GAS");
  });
});

// Flap audit flag 3: the tax duration is an explicit term with the longest default the factory allows.
describe("tax duration", () => {
  it("defaults to 100 years, inside the factory's bounds, and is encoded from the form", () => {
    expect(DEFAULT_TERMS.taxDuration).toBe(BOUNDS.taxDurationMax);
    expect(longSpan(DEFAULT_TERMS.taxDuration)).toBe("100 years");
    const check = factoryAbi.find((x) => x.type === "function" && x.name === "checkTerms") as AbiFunction;
    const tuple = termsTuple(check.inputs[0]!, { ...DEFAULT_TERMS, taxDuration: 365 * 86_400 }, `0x${"11".repeat(32)}`);
    expect(tuple.taxDuration).toBe(365 * 86_400);
  });
});

// Flap audit flags 1 and the floor fix: the factory's refusals read in words in the Create form.
describe("factory reasons", () => {
  const revert = (errorName: string, args: unknown[]) => {
    const data = encodeErrorResult({ abi: factoryAbi, errorName, args } as never);
    return new BaseError("reverted", { cause: new ContractFunctionRevertedError({ abi: factoryAbi, data, functionName: "checkTerms" }) });
  };
  it("a blocked name", () => {
    expect(factoryReason(revert("NameOrSymbolBlocked", ["BNB"]))).toMatch(/"BNB" is on Flap's list/);
  });
  it("a minimum raise under Flap's floor, with the minimum it needs", () => {
    const m = factoryReason(revert("PoolSeedBelowFlapFloor", [parseEther("10"), parseEther("14.2857"), parseEther("57.1428"), true]));
    expect(m).toMatch(/graduation floor/);
    expect(m).toMatch(/at least 57\.1428 BNB/);
  });
  it("anything else is left to the generic message", () => {
    expect(factoryReason(new Error("boom"))).toBeNull();
  });
});
