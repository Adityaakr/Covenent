import { getContractAddress, keccak256, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { FLAP } from "@/lib/covenant/defaults";
import { cloneInitCodeHash, predictClone, saltFrom } from "./salt";

describe("7777 salt mining", () => {
  const impl = FLAP.taxTokenImpl;
  const portal = FLAP.portal;

  it("hashes the EIP-1167 clone init code of the tax token implementation", () => {
    const code = `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${impl.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3` as Hex;
    expect(cloneInitCodeHash(impl)).toBe(keccak256(code));
  });

  it("predicts the same CREATE2 address as viem", () => {
    const salt = saltFrom(123456789n, 42n);
    const want = getContractAddress({ opcode: "CREATE2", from: portal, salt, bytecodeHash: cloneInitCodeHash(impl) });
    expect(predictClone(portal, salt, cloneInitCodeHash(impl))).toBe(want);
  });

  it("finds a salt whose token address ends in 7777", () => {
    const h = cloneInitCodeHash(impl);
    let found: string | null = null;
    for (let i = 0n; i < 600_000n && !found; i++) {
      const a = predictClone(portal, saltFrom(20261126n, i), h);
      if (a.toLowerCase().endsWith("7777")) found = a;
    }
    expect(found).not.toBeNull();
  }, 60_000);
});
