/*
 * Live create: Flap's Portal deploys covenant launchers. The call is
 *   Portal.newLauncher{value: SALT_LOCK_FEE}(launcherFactory, abi.encode(Terms))
 * with the Terms tuple taken from the factory's own checkTerms(Terms) input, so the encoding follows the deployed
 * contract field by field. checkTerms is also run first as a view: a term outside the factory's profile reverts there
 * with the factory's own error instead of costing a failed transaction.
 */
import { ContractFunctionRevertedError, decodeEventLog, encodeAbiParameters, formatEther, parseEther, zeroAddress, type Abi, type AbiFunction, type AbiParameter, type Hex, type PublicClient } from "viem";
import type { Config } from "wagmi";
import { simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import type { Address, Terms } from "@/lib/covenant/types";
import type { ProfileBounds } from "@/lib/covenant/create-check";
import { abiFor, addressOf, fn, type DeploymentPayload } from "./deployment";

export type FactoryKind = "demo" | "production";

const IDENTITY: Abi = [
  { type: "function", name: "register", stateMutability: "nonpayable", inputs: [{ name: "agentURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
];
const PORTAL: Abi = [
  { type: "function", name: "SALT_LOCK_FEE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "newLauncher", stateMutability: "payable", inputs: [{ name: "factory", type: "address" }, { name: "data", type: "bytes" }], outputs: [{ name: "launcher", type: "address" }] },
];

export interface CreateTargets {
  portal?: Address;
  factory?: Address;
  identityRegistry?: Address;
  termsParam?: AbiParameter;
  factoryAbi?: Abi;
  launcherFactoryAbi?: Abi;
}

export function createTargets(payload: DeploymentPayload | undefined, kind: FactoryKind): CreateTargets {
  const d = payload?.deployment;
  if (!d) return {};
  const F = abiFor(payload.abis, "CovenantLauncherFactory", "LauncherFactory");
  const check = fn(F, "checkTerms") as AbiFunction | undefined;
  return {
    portal: addressOf(d, "portal", "flapPortal", "mockPortal"),
    factory: kind === "demo" ? addressOf(d, "demoLauncherFactory") ?? addressOf(d, "launcherFactory") : addressOf(d, "launcherFactory"),
    identityRegistry: addressOf(d, "identityRegistry", "erc8004Identity"),
    termsParam: check?.inputs[0],
    factoryAbi: F,
    launcherFactoryAbi: F,
  };
}

/** One value of the Terms tuple from the form, by the contract's field name. */
function termsValue(p: AbiParameter, t: Terms, salt: Hex, relayer: Address): unknown {
  const wei = (n: number) => parseEther(String(n));
  const map: Record<string, unknown> = {
    name: t.name, symbol: t.symbol, meta: t.meta, salt,
    totalSupply: wei(t.totalSupply), saleBps: t.saleBps, poolBps: t.poolBps, trancheBps: t.trancheBps, trancheMultiple: t.trancheMultiple,
    minRaise: wei(t.minRaise), cap: wei(t.cap), saleDuration: t.saleDuration, buyTaxBps: t.buyTaxBps, sellTaxBps: t.sellTaxBps,
    taxDuration: t.taxDuration, teamWallet: t.teamWallet, tapUsdPer30d: wei(t.tapUsdPer30d), tapCapBps: t.tapCapBps, cliff: t.cliff,
    unlockWindow: t.unlockWindow, exitStreak: t.exitStreak, roundLength: t.roundLength, cooldown: t.cooldown, exitFeeBps: t.exitFeeBps,
    heartbeat: t.heartbeat, agentId: BigInt(t.agentId), reportRelayer: relayer,
  };
  if (!p.name || !(p.name in map)) throw new Error(`The factory's Terms has a field the form does not know: ${p.name}`);
  const v = map[p.name];
  if (p.type.endsWith("[]") && Array.isArray(v)) return v;
  if (p.type.startsWith("uint") && typeof v === "number") return p.type === "uint256" || p.type === "uint64" ? BigInt(v) : v;
  return v;
}

export function termsTuple(param: AbiParameter, t: Terms, salt: Hex, relayer: Address = zeroAddress): Record<string, unknown> {
  if (param.type !== "tuple" || !("components" in param)) throw new Error("checkTerms does not take a Terms tuple");
  return Object.fromEntries(param.components.map((c) => [c.name, termsValue(c, t, salt, relayer)]));
}

/** Run the factory's checkTerms view. Returns null when the terms pass, or the factory's reason. */
export async function checkTerms(client: PublicClient, tg: CreateTargets, t: Terms, salt: Hex, relayer?: Address): Promise<string | null> {
  if (!tg.factory || !tg.termsParam || !tg.factoryAbi) return "The deployment names no launcher factory with checkTerms";
  try {
    await client.readContract({ address: tg.factory, abi: tg.factoryAbi, functionName: "checkTerms", args: [termsTuple(tg.termsParam, t, salt, relayer)] });
    return null;
  } catch (e) {
    const named = factoryReason(e);
    if (named) return named;
    const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message;
    return m.split("\n").find((l) => /reverted|error/i.test(l))?.trim() ?? m.split("\n")[0]!;
  }
}

/** The factory's refusals that come from Flap, in words: the name screen, the liquidity floor, the tax window. */
export function factoryReason(e: unknown): string | null {
  const err = e as { walk?: (f: (x: unknown) => boolean) => unknown };
  const found = (typeof err.walk === "function" ? err.walk((x) => x instanceof ContractFunctionRevertedError) : null) as ContractFunctionRevertedError | null;
  const name = found?.data?.errorName;
  const args = (found?.data?.args ?? []) as readonly unknown[];
  const b = (x: unknown) => Number(formatEther(BigInt(x as bigint))).toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (name === "NameOrSymbolBlocked") return `"${String(args[0])}" is on Flap's list of blocked names and symbols; Flap would refuse the launch. Pick another name or symbol.`;
  if (name === "PoolSeedBelowFlapFloor") return `At this pool share Flap's ${args[3] ? "graduation" : "launch"} floor needs a pool seed of ${b(args[1])} BNB, so the minimum raise must be at least ${b(args[2])} BNB (it seeds ${b(args[0])} BNB now).`;
  if (name === "BadTaxDuration") return "The tax must run from 30 days to 100 years.";
  if (name === "QuoteNotEnabled") return "Flap has not enabled BNB launches on this Portal.";
  if (name === "NameScreenUnavailable") return "Flap's name screen did not answer; the factory refuses creation until it does. Try again in a moment.";
  if (name === "AgentNotFound") return `Agent #${String(args[0])} is not registered in the ERC-8004 identity registry on this chain.`;
  if (name === "AgentNotOwnedByTeam") return `Agent #${String(args[0])} belongs to ${String(args[1])}, not the team wallet. Make that wallet the team wallet, or register an agent from yours.`;
  if (name === "AgentRegistryMissing") return "This factory has no ERC-8004 identity registry; create with a human issuer.";
  if (name) return `The factory refuses the terms (${name}).`;
  return null;
}

/** A placeholder salt for checkTerms before mining: the factory only asks that it is not zero (the Portal checks it). */
export const CHECK_SALT: Hex = "0x0000000000000000000000000000000000000000000000000000000000000001";

/** Which field the factory's refusal belongs to, so the page can show it there. */
export function factoryReasonField(e: unknown): "name" | "symbol" | "agentId" | "minRaise" | null {
  const err = e as { walk?: (f: (x: unknown) => boolean) => unknown };
  const found = (typeof err.walk === "function" ? err.walk((x) => x instanceof ContractFunctionRevertedError) : null) as ContractFunctionRevertedError | null;
  const name = found?.data?.errorName;
  if (name === "NameOrSymbolBlocked") return "name";
  if (name === "AgentNotFound" || name === "AgentNotOwnedByTeam") return "agentId";
  if (name === "PoolSeedBelowFlapFloor") return "minRaise";
  return null;
}

/** The factory's verdict on the terms as they stand: ok, or its reason and the field it points at. */
export async function factoryVerdict(client: PublicClient, tg: CreateTargets, t: Terms): Promise<{ ok: true } | { ok: false; reason: string; field: ReturnType<typeof factoryReasonField> }> {
  if (!tg.factory || !tg.termsParam || !tg.factoryAbi) return { ok: false, reason: "The deployment names no launcher factory with checkTerms", field: null };
  try {
    await client.readContract({ address: tg.factory, abi: tg.factoryAbi, functionName: "checkTerms", args: [termsTuple(tg.termsParam, t, CHECK_SALT)] });
    return { ok: true };
  } catch (e) {
    const named = factoryReason(e);
    const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message;
    return { ok: false, reason: named ?? m.split("\n")[0]!, field: factoryReasonField(e) };
  }
}

const SCREEN: Abi = [
  { type: "function", name: "nameScreen", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "isScamWord", stateMutability: "view", inputs: [{ name: "name", type: "string" }, { name: "symbol", type: "string" }], outputs: [{ name: "nameBlocked", type: "bool" }, { name: "symbolBlocked", type: "bool" }] },
];

/** Flap's name screen, through the factory's own pointer to it. null when there is none (local chains) or it did not answer. */
export async function screenName(client: PublicClient, tg: CreateTargets, name: string, symbol: string): Promise<{ name: boolean; symbol: boolean } | null> {
  if (!tg.factory) return null;
  try {
    const screen = (await client.readContract({ address: tg.factory, abi: SCREEN, functionName: "nameScreen" })) as Address;
    if (!screen || screen === zeroAddress) return null;
    const [n, s] = (await client.readContract({ address: screen, abi: SCREEN, functionName: "isScamWord", args: [name, symbol] })) as readonly [boolean, boolean];
    return { name: n, symbol: s };
  } catch {
    return null;
  }
}

/** The factory's time bounds (CovenantProfiles), read from the chain. null when the factory has no profile view. */
export async function readProfile(client: PublicClient, tg: CreateTargets): Promise<ProfileBounds | null> {
  if (!tg.factory || !tg.factoryAbi || !fn(tg.factoryAbi, "profile")) return null;
  try {
    const p = (await client.readContract({ address: tg.factory, abi: tg.factoryAbi, functionName: "profile" })) as Record<string, number | boolean>;
    const n = (k: string) => Number(p[k]);
    return {
      minSaleDuration: n("minSaleDuration"), maxSaleDuration: n("maxSaleDuration"), minExitStreak: n("minExitStreak"), maxExitStreak: n("maxExitStreak"),
      minRoundLength: n("minRoundLength"), minCooldown: n("minCooldown"), minHeartbeat: n("minHeartbeat"), maxHeartbeat: n("maxHeartbeat"),
      minUnlockWindow: n("minUnlockWindow"), maxCliff: n("maxCliff"), antiFarmerDuration: n("antiFarmerDuration"), requireGraduation: Boolean(p.requireGraduation),
    };
  } catch {
    return null;
  }
}

export interface FlapFloor {
  /** the smallest minimum raise the factory accepts for this split, BNB */
  minRaise: number;
  /** the pool seed that takes, BNB */
  minSeed: number;
  /** Flap's floor in USD and the BNB price the Portal uses for it */
  floorUsd: number;
  priceUsd: number;
  /** true: the graduation floor (every factory since Flap's re-review); false: the launch floor (older demo factory) */
  graduation: boolean;
  /** the factory's safety margin on the floor, bps (15000 = 1.5x); 10000 for factories without one */
  marginBps: number;
}

/** The factory's minRaiseFor view: Flap's live floor for a split, read from the Portal through the factory. */
export async function flapFloor(client: PublicClient, tg: CreateTargets, totalSupply: number, saleBps: number, poolBps: number): Promise<FlapFloor | null> {
  if (!tg.factory || !tg.factoryAbi || !fn(tg.factoryAbi, "minRaiseFor") || saleBps <= 0 || poolBps <= 0) return null;
  try {
    const r = (await client.readContract({ address: tg.factory, abi: tg.factoryAbi, functionName: "minRaiseFor", args: [parseEther(String(totalSupply)), saleBps, poolBps] })) as readonly [bigint, bigint, bigint, bigint, boolean, bigint?];
    const n = (x: bigint) => Number(formatEther(x));
    return { minRaise: n(r[0]), minSeed: n(r[1]), floorUsd: n(r[2]), priceUsd: n(r[3]), graduation: r[4], marginBps: r[5] !== undefined ? Number(r[5]) : 10_000 };
  } catch {
    return null;
  }
}

/** Register an ERC-8004 identity from the connected wallet (it becomes the team wallet's agent NFT). */
export async function registerAgent(config: Config, chainId: number, registry: Address, account: Address, uri: string): Promise<bigint> {
  const sim = await simulateContract(config, { address: registry, abi: IDENTITY, functionName: "register", args: [uri], account, chainId });
  const hash = await writeContract(config, sim.request as Parameters<typeof writeContract>[1]);
  const rc = await waitForTransactionReceipt(config, { hash, chainId });
  if (rc.status !== "success") throw new Error("register reverted");
  return sim.result as bigint;
}

export async function agentOwner(client: PublicClient, registry: Address, agentId: bigint): Promise<Address | null> {
  try {
    return (await client.readContract({ address: registry, abi: IDENTITY, functionName: "ownerOf", args: [agentId] })) as Address;
  } catch {
    return null;
  }
}

const CREATED: Abi = [
  {
    type: "event", name: "CovenantCreated", anonymous: false,
    inputs: [
      { name: "launcher", type: "address", indexed: true }, { name: "creator", type: "address", indexed: true },
      { name: "teamWallet", type: "address", indexed: true }, { name: "agentId", type: "uint256", indexed: false },
      { name: "salt", type: "bytes32", indexed: false },
    ],
  },
];

/** Send Portal.newLauncher and return the new launcher's address (from the factory's CovenantCreated event). */
export async function createCovenantLive(
  config: Config, client: PublicClient, chainId: number, tg: CreateTargets, t: Terms, salt: Hex, relayer: Address = zeroAddress,
): Promise<{ hash: Hex; launcher?: Address }> {
  if (!tg.portal || !tg.factory || !tg.termsParam) throw new Error("The deployment names no Portal and launcher factory");
  const data = encodeAbiParameters([tg.termsParam], [termsTuple(tg.termsParam, t, salt, relayer)]);
  const fee = (await client.readContract({ address: tg.portal, abi: PORTAL, functionName: "SALT_LOCK_FEE" }).catch(() => 0n)) as bigint;
  const hash = await writeContract(config, { address: tg.portal, abi: PORTAL, functionName: "newLauncher", args: [tg.factory, data], value: fee, chainId } as unknown as Parameters<typeof writeContract>[1]);
  const rc = await waitForTransactionReceipt(config, { hash, chainId });
  if (rc.status !== "success") throw new Error("newLauncher reverted");
  const abi = tg.launcherFactoryAbi ?? CREATED;
  for (const log of rc.logs) {
    if (log.address.toLowerCase() !== tg.factory.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
      if (ev.eventName === "CovenantCreated") return { hash, launcher: (ev.args as unknown as { launcher: Address }).launcher };
    } catch { /* another event */ }
  }
  return { hash };
}
