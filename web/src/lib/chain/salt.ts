/*
 * Flap requires the token address to end in 7777. The token is an EIP-1167 clone of the tax token implementation,
 * deployed by the Portal with CREATE2, so its address is predictable from (portal, salt, implementation).
 * About 65,536 tries on average; the miner runs in a web worker (salt.worker.ts).
 */
import { concatHex, getAddress, keccak256, type Address, type Hex } from "viem";

export function cloneInitCodeHash(implementation: Address): Hex {
  const impl = implementation.toLowerCase().replace(/^0x/, "");
  return keccak256(`0x3d602d80600a3d3981f3363d3d373d3d3d363d73${impl}5af43d82803e903d91602b57fd5bf3` as Hex);
}

export function predictClone(deployer: Address, salt: Hex, initCodeHash: Hex): Address {
  const h = keccak256(concatHex(["0xff", deployer, salt, initCodeHash]));
  return getAddress(`0x${h.slice(26)}`);
}

export function saltFrom(seed: bigint, i: bigint): Hex {
  return `0x${(seed + i).toString(16).padStart(64, "0").slice(-64)}` as Hex;
}

export interface MineRequest { deployer: Address; implementation: Address; seed: string; suffix: string }
export type MineMessage = { type: "progress"; tries: number; rate: number } | { type: "found"; salt: Hex; address: Address; tries: number; ms: number };
