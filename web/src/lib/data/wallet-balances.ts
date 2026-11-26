"use client";

/*
 * The connected wallet's balances for the header: native BNB (tBNB on BNB testnet) and test USDT, read on the chain
 * the app reads (the deployment's chain). Both come from the queries the funds page already uses, so a mint or a
 * drip there updates the header too. They refresh when a new block arrives (watched by polling, at most every few
 * seconds) and after any transaction the app sends (see actions.ts). Nothing is shown until the chain answers.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWallet } from "@/components/providers";
import { useNativeBalance } from "./faucet";
import { useSource } from "./hooks";
import { useDemoUsdc } from "./usdc";

/** Query keys that hold wallet balances; invalidate them after a transaction lands. */
export const BALANCE_KEYS = [["native-balance"], ["usdc"]] as const;

const BLOCK_POLL_MS = 4_000;

export function useWalletBalances() {
  const src = useSource();
  const { address } = useWallet();
  const qc = useQueryClient();
  const bnb = useNativeBalance();
  const usdc = useDemoUsdc(address);
  const client = src.mode === "live" ? src.client : undefined;
  const live = Boolean(client);

  // Resubscribes when the source probe hands back a new client; that is cheap (one polling timer).
  useEffect(() => {
    if (!client || !address) return;
    return client.watchBlockNumber({
      poll: true,
      pollingInterval: BLOCK_POLL_MS,
      emitOnBegin: false,
      onBlockNumber: () => { for (const k of BALANCE_KEYS) void qc.invalidateQueries({ queryKey: [...k] }); },
      onError: () => { /* the interval queries keep the numbers fresh */ },
    });
  }, [client, address, qc]);

  return {
    live,
    chainId: src.chainId,
    bnb: { value: bnb.data, loading: live && Boolean(address) && bnb.data === undefined && !bnb.isError },
    usdc: {
      deployed: usdc.data ? usdc.data.deployed : undefined,
      value: usdc.data?.deployed ? usdc.data.balance : undefined,
      loading: live && Boolean(address) && usdc.data === undefined && !usdc.isError,
    },
  };
}

/** A BNB balance for a compact slot: 2 decimals, more for dust, 0 as "0". */
export function fmtBnbBalance(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 0.01) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0.0001 ? "<0.0001" : n.toLocaleString("en-US", { maximumSignificantDigits: 2 });
}

/** A dollar-token balance: whole units with separators, 12.5K past ten thousand. */
export function fmtUsdBalance(n: number, compact = false): string {
  if (compact && n >= 10_000) return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
  return n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 0 : 2 });
}
