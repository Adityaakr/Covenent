"use client";

/*
 * Live BNB/USD, as the contracts see it: CovenantOracle.pushBnbUsd(), the Atlas push feed's fresh rate (1e18 USD per
 * BNB), or 0 when the feed is stale or absent. The oracle's address comes from the deployment record. Screens that
 * price a dollar figure in BNB before any covenant exists (the Create preview) use this; a covenant's own screens use
 * the rate its vault last stored.
 */
import { useQuery } from "@tanstack/react-query";
import { formatEther, type Abi } from "viem";
import { addressOf } from "@/lib/chain/deployment";
import { useSource } from "./hooks";

export function useBnbUsd() {
  const src = useSource();
  const d = src.payload?.deployment;
  const oracle = d ? addressOf(d, "oracle", "covenantOracle") : undefined;
  const abi = src.payload?.abis.CovenantOracle as Abi | undefined;
  return useQuery({
    queryKey: ["bnb-usd", src.chainId, oracle],
    enabled: src.mode === "live" && Boolean(src.client && oracle && abi),
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const raw = (await src.client!.readContract({ address: oracle!, abi: abi!, functionName: "pushBnbUsd" })) as bigint;
      const rate = Number(formatEther(raw));
      return rate > 0 ? rate : null; // null: the feed is stale or absent right now
    },
  });
}
