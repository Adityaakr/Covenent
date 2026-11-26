"use client";

/*
 * Covenant AI's confirmation cards, wired up: the views (ask-card-views.tsx) with the user's wallet, the chain and the chat
 * store. Nothing is signed anywhere but the user's own wallet, after they press the button; before sending, each step
 * is simulated again on the current block from the signing wallet, and a step that would revert is not sent. Every
 * outcome (sent, rejected, failed, cancelled) is queued as a note for the model's next turn.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import type { Address, Hash, Hex } from "viem";
import { useWallet } from "@/components/providers";
import { note, setCard, useAskAI } from "@/lib/ai/client";
import type { Proposal } from "@/lib/ai/types";
import { createCovenantLive, createTargets } from "@/lib/chain/create";
import { addressOf } from "@/lib/chain/deployment";
import type { MineMessage } from "@/lib/chain/salt";
import { FLAP } from "@/lib/covenant/defaults";
import { useSource } from "@/lib/data/hooks";
import { short } from "@/lib/format";
import { CreateCardView, TxCardView, type CardActions } from "./ask-card-views";

/* ---------- container: wallet, chain, store ---------- */

const toB64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const errText = (e: unknown) => (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e);
const rejected = (m: string) => /User rejected|denied|rejected the request/i.test(m);

export function ProposalCard({ p }: { p: Proposal }) {
  const wallet = useWallet();
  const src = useSource();
  const config = useConfig();
  const qc = useQueryClient();
  const card = useAskAI().cards[p.id] ?? { status: "pending" as const };
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);

  const wrongSigner = Boolean(p.signer && wallet.address && p.signer.toLowerCase() !== wallet.address.toLowerCase() && p.kind !== "create");
  const busy = (detail: string, step = 0, submitted = false) => setCard(p.id, { status: submitted ? "submitted" : "signing", detail, step });
  const fail = (e: unknown) => {
    const m = errText(e);
    if (rejected(m)) { note(`The user rejected "${p.title}" in their wallet.`); setCard(p.id, { status: "rejected" }); return; }
    const message = m.split("\n")[0]!.slice(0, 220);
    note(`"${p.title}" was not completed: ${message}`);
    setCard(p.id, { status: "error", message });
  };

  async function mineSalt(): Promise<Hex> {
    const d = src.payload!.deployment!;
    const portal = addressOf(d, "portal", "flapPortal", "mockPortal") || FLAP.portal;
    const impl = addressOf(d, "taxTokenImpl", "taxTokenImplementation", "tokenImpl") || FLAP.taxTokenImpl;
    return new Promise((resolve, reject) => {
      worker.current?.terminate();
      const w = new Worker(new URL("../../lib/chain/salt.worker.ts", import.meta.url), { type: "module" });
      worker.current = w;
      w.onerror = () => reject(new Error("The salt miner failed to start"));
      w.onmessage = (e: MessageEvent<MineMessage>) => {
        if (e.data.type === "progress") busy(`Mining a token address ending in 7777: ${e.data.tries.toLocaleString("en-US")} tries`);
        else { w.terminate(); resolve(e.data.salt); }
      };
      w.postMessage({ deployer: portal, implementation: impl, seed: String(BigInt(Date.now()) * 1_000_003n), suffix: "7777" });
    });
  }

  async function sign() {
    if (!wallet.address) { wallet.connect(); return; }
    if (src.mode !== "live" || !src.client || !src.payload?.deployment) { setCard(p.id, { status: "error", message: `Not connected to the chain: ${src.reason}` }); return; }
    if (src.chainId !== p.chainId) { setCard(p.id, { status: "error", message: `This card is for chain ${p.chainId}; the app reads chain ${src.chainId}.` }); return; }
    try {
      if (p.kind === "create" && p.create) {
        busy("Mining a token address ending in 7777");
        const salt = await mineSalt();
        busy("Confirm Portal.newLauncher in your wallet");
        const { hash, launcher } = await createCovenantLive(config, src.client, p.chainId, createTargets(src.payload, p.create.factory), p.create.terms, salt);
        note(`Signed and sent "${p.title}": ${hash} (success${launcher ? `, launcher ${launcher}` : ""})`);
        await qc.invalidateQueries({ queryKey: ["source"] });
        setCard(p.id, { status: "confirmed", hashes: [hash], ...(launcher ? { launcher } : {}) });
        return;
      }
      const hashes: Hash[] = [];
      for (let i = 0; i < p.txs.length; i++) {
        const tx = p.txs[i]!;
        const of = p.txs.length > 1 ? ` (step ${i + 1} of ${p.txs.length})` : "";
        // simulate again on the current block, from the wallet that will sign
        busy(`Simulating ${tx.functionName}${of}`, i);
        try {
          await src.client.call({ account: wallet.address as Address, to: tx.to, data: tx.data, value: BigInt(tx.value), ...(tx.gas ? { gas: BigInt(tx.gas) } : {}) });
        } catch (e) {
          throw new Error(`Step ${i + 1} (${tx.functionName}) would revert now, so it was not sent: ${errText(e).split("\n")[0]}`);
        }
        busy(`Confirm ${tx.functionName} in your wallet${of}`, i);
        const hash = await sendTransaction(config, { to: tx.to, data: tx.data, value: BigInt(tx.value), chainId: p.chainId, ...(tx.gas ? { gas: BigInt(tx.gas) } : {}) });
        busy(`Submitted ${short(hash, 8, 4)}, waiting for the block`, i, true);
        const rc = await waitForTransactionReceipt(config, { hash, chainId: p.chainId });
        if (rc.status !== "success") throw new Error(`${tx.functionName} reverted in block ${rc.blockNumber}`);
        hashes.push(hash);
      }
      note(`Signed and sent "${p.title}": ${hashes.join(", ")} (success)`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["covenants"] }), qc.invalidateQueries({ queryKey: ["native-balance"] }), qc.invalidateQueries({ queryKey: ["usdc"] })]);
      setCard(p.id, { status: "confirmed", hashes });
    } catch (e) {
      fail(e);
    }
  }

  const a: CardActions = {
    card, account: wallet.address,
    onSign: () => void sign(),
    onCancel: () => { worker.current?.terminate(); note(`The user cancelled "${p.title}" without signing.`); setCard(p.id, { status: "cancelled" }); },
    onConnect: () => wallet.connect(),
  };
  if (p.kind === "create" && p.create) {
    const editHref = `/app/create?draft=${encodeURIComponent(toB64(JSON.stringify({ factory: p.create.factory, terms: p.create.terms })))}`;
    return <CreateCardView p={p} a={a} editHref={editHref} />;
  }
  return <TxCardView p={p} a={a} wrongSigner={wrongSigner} />;
}
