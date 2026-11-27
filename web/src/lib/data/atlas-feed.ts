"use client";

/*
 * The Atlas BNB/USD push feed, read live: the address CovenantOracle.PUSH_FEED() names, its latest round
 * (Chainlink's latestRoundData), the oracle's freshness bound (PUSH_MAX_AGE) and the rounds it published recently.
 * The trust panel shows it next to the rate a vault last stored, so the feed is visibly working even between pokes.
 */
import { useQuery } from "@tanstack/react-query";
import { encodeFunctionData, formatEther, formatUnits, type Abi, type PublicClient } from "viem";
import { addressOf } from "@/lib/chain/deployment";
import { fetchRange, TESTNET_LOG_SOURCES } from "@/lib/chain/logs";
import { LOCAL_MODE } from "@/lib/chain/target";
import type { Address } from "@/lib/covenant/types";
import { useSource } from "./hooks";

/** The Chainlink AggregatorV3 surface Atlas single-feed contracts expose (CovenantOracle's IAggregatorV3). */
const AGGREGATOR = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function", name: "latestRoundData", stateMutability: "view", inputs: [],
    outputs: [{ name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" }],
  },
] as const;

export interface AtlasRound { t: number; price: number }

export interface AtlasFeed {
  feed: Address;
  description: string;
  /** USD per BNB in the latest round */
  price: number;
  /** unix seconds of the latest round */
  updatedAt: number;
  /** the oracle treats a round older than this as stale (seconds) */
  maxAge: number;
  /** recent rounds, oldest first (empty when the feed's logs are not readable) */
  rounds: AtlasRound[];
}

/** Blocks of feed history to read for the sparkline: about 20 minutes of BNB testnet, one log query. */
const HISTORY_BLOCKS = 3_000n;

/**
 * One round from an Atlas single-feed update log. The feed packs each update into 16 bytes of data: a uint48 update
 * time then a uint80 answer at 18 decimals. Anything else, or a value that does not look like a round of this feed
 * (outside the last day, or more than 50% from the latest answer), returns null, so an unknown event never draws.
 */
export function decodeAtlasRound(data: string, latest: { price: number; updatedAt: number }): AtlasRound | null {
  if (!/^0x[0-9a-fA-F]{32}$/.test(data)) return null;
  const t = Number.parseInt(data.slice(2, 14), 16);
  const price = Number(formatUnits(BigInt(`0x${data.slice(14)}`), 18));
  if (!(t > latest.updatedAt - 86_400 && t <= latest.updatedAt)) return null;
  if (!(latest.price > 0 && Math.abs(price / latest.price - 1) <= 0.5)) return null;
  return { t, price };
}

/** Recent rounds from the feed's own logs, oldest first, one per update time. */
export function roundsFromLogs(logs: { data: string }[], latest: { price: number; updatedAt: number }): AtlasRound[] {
  const byTime = new Map<number, AtlasRound>();
  for (const l of logs) {
    const r = decodeAtlasRound(l.data, latest);
    if (r) byTime.set(r.t, r);
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

async function readRounds(client: PublicClient, feed: Address, local: boolean, floor: bigint, latest: { price: number; updatedAt: number }): Promise<AtlasRound[]> {
  try {
    const head = await client.getBlockNumber();
    let from = head > HISTORY_BLOCKS ? head - HISTORY_BLOCKS : 0n;
    if (from < floor) from = floor; // on a fork, blocks at or below the fork block hit the upstream RPC
    const logs = local ? await client.getLogs({ address: feed, fromBlock: from, toBlock: head }) : await fetchRange(TESTNET_LOG_SOURCES, feed, from, head, head);
    return roundsFromLogs(logs, latest);
  } catch {
    return [];
  }
}

/** The live Atlas push feed behind the deployment's CovenantOracle; data is null when the oracle has no push feed. */
export function useAtlasFeed() {
  const src = useSource();
  const d = src.payload?.deployment;
  const oracle = d ? addressOf(d, "oracle", "covenantOracle") : undefined;
  const abi = src.payload?.abis.CovenantOracle as Abi | undefined;
  return useQuery({
    queryKey: ["atlas-feed", src.chainId, oracle],
    enabled: src.mode === "live" && Boolean(src.client && oracle && abi),
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async (): Promise<AtlasFeed | null> => {
      const client = src.client!;
      const [feed, maxAge] = await Promise.all([
        client.readContract({ address: oracle!, abi: abi!, functionName: "PUSH_FEED" }) as Promise<Address>,
        client.readContract({ address: oracle!, abi: abi!, functionName: "PUSH_MAX_AGE" }).then(Number).catch(() => 0),
      ]);
      if (!feed || /^0x0{40}$/i.test(feed)) return null;
      const [decimals, description, round] = await Promise.all([
        client.readContract({ address: feed, abi: AGGREGATOR, functionName: "decimals" }).catch(() => 18),
        client.readContract({ address: feed, abi: AGGREGATOR, functionName: "description" }).catch(() => "BNB/USD"),
        client.readContract({ address: feed, abi: AGGREGATOR, functionName: "latestRoundData" }),
      ]);
      const latest = { price: Number(formatUnits(round[1] > 0n ? round[1] : 0n, decimals)), updatedAt: Number(round[3]) };
      const rounds = await readRounds(client, feed, LOCAL_MODE, BigInt(d!.startBlock ?? 0) + 1n, latest);
      return { feed, description, maxAge, ...latest, rounds };
    },
  });
}

export interface PokeInfo {
  /** unix seconds when a poke carrying a fresh rate is allowed again (0 = now / never poked) */
  nextRateAt: number;
  /** unix seconds when any poke is allowed again */
  nextAt: number;
  /** estimated network fee of poke(vault) in BNB, when the node can estimate it right now */
  feeBnb: number | null;
}

/** When `vault` can next be poked through `oracle` (the one the vault accepts) and roughly what a poke costs. */
export function usePokeInfo(oracle: Address | undefined, vault: Address | undefined, account: Address | undefined) {
  const src = useSource();
  const abi = src.payload?.abis.CovenantOracle as Abi | undefined;
  return useQuery({
    queryKey: ["poke-info", src.chainId, oracle, vault, account],
    enabled: src.mode === "live" && Boolean(src.client && oracle && abi && vault),
    refetchInterval: 30_000,
    staleTime: 10_000,
    queryFn: async (): Promise<PokeInfo> => {
      const client = src.client!;
      const read = (fn: string) => client.readContract({ address: oracle!, abi: abi!, functionName: fn, args: [vault!] }).then(Number).catch(() => 0);
      const data = encodeFunctionData({ abi: abi!, functionName: "poke", args: [vault!] });
      const [nextRateAt, nextAt, gas, gasPrice] = await Promise.all([
        read("nextRatePokeAt"),
        read("nextPokeAt"),
        client.estimateGas({ to: oracle!, data, account }).catch(() => null),
        client.getGasPrice().catch(() => null),
      ]);
      return { nextRateAt, nextAt, feeBnb: gas !== null && gasPrice !== null ? Number(formatEther(gas * gasPrice)) : null };
    },
  });
}
