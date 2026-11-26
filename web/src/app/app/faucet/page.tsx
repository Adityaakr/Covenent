"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@/components/app/icons";
import { Note, Skeleton } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { chainName } from "@/lib/chain/chains";
import { useSource } from "@/lib/data/hooks";
import { requestFunds, useBalances, useFaucetStatus, useSwap } from "@/lib/data/faucet";
import { short } from "@/lib/format";

/*
 * Get test funds: local dev chain only. The server sends test BNB from an anvil account and mints Demo USDC; the
 * swap trades dUSDC for BNB on the local PancakeSwap pool. Covenant raises stay BNB-quoted; dUSDC never enters a vault.
 */
export default function FaucetPage() {
  const src = useSource();
  const wallet = useWallet();
  const qc = useQueryClient();
  const status = useFaucetStatus();
  const bal = useBalances(status.data?.demoUsdc);
  const swap = useSwap(status.data);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [amount, setAmount] = useState("1000");
  const [quote, setQuote] = useState<number | null>(null);

  async function getFunds() {
    if (!wallet.address) { wallet.connect(); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await requestFunds(wallet.address);
      setMsg({ tone: "good", text: `Sent ${Number(r.bnbWei) / 1e18} test BNB (${short(r.bnbTx)})${r.usdc ? ` and minted ${Number(r.usdc).toLocaleString("en-US")} dUSDC (${short(r.usdcTx ?? "")})` : ""} on the local chain.` });
      await qc.invalidateQueries({ queryKey: ["balances"] });
    } catch (e) {
      setMsg({ tone: "warn", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function doSwap() {
    if (!wallet.address) { wallet.connect(); return; }
    setBusy(true); setMsg(null);
    try {
      const h = await swap.swap(Number(amount));
      setMsg({ tone: "good", text: `Swapped ${Number(amount).toLocaleString("en-US")} dUSDC for BNB on the local PancakeSwap pool (${short(h)}).` });
    } catch (e) {
      setMsg({ tone: "warn", text: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const off = status.isError ? `The Covenant server did not answer (${(status.error as Error).message}). Start the stack with scripts/dev-all.sh.` : status.data && !status.data.enabled ? status.data.reason : null;

  return (
    <main className="page page-narrow">
      <div style={{ display: "grid", gap: 8 }}>
        <p className="eyebrow">Local test funds</p>
        <h1 className="d1">Get test funds. <span className="soft">Dev chain only, worthless anywhere else.</span></h1>
        <p className="lede">Test BNB from one of anvil&apos;s public accounts and Demo USDC (dUSDC) minted by the dev stack, sent to the connected wallet on {src.chainId ? chainName(src.chainId) : "the local chain"}. Raises are in BNB, as Flap requires; dUSDC is here to fund a wallet and swap to BNB on the local PancakeSwap pool.</p>
      </div>

      {off ? <Note tone="warn" icon="alert">{off}</Note> : null}

      <div className="card">
        <div className="card-head"><h3 className="d4">Your wallet</h3><span className="tiny muted">{wallet.address ? short(wallet.address) : "Not connected"}</span></div>
        <div className="card-body stack">
          {!wallet.address ? (
            <button className="btn btn-primary" onClick={() => wallet.connect()}><Icon name="wallet" size={16} />Connect a wallet</button>
          ) : bal.isLoading ? <Skeleton h={60} /> : (
            <dl className="kv">
              <dt>BNB</dt><dd className="mono">{bal.data ? bal.data.bnb.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "–"}</dd>
              <dt>dUSDC (local test token)</dt><dd className="mono">{bal.data?.usdc === null || bal.data?.usdc === undefined ? "not deployed" : bal.data.usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
            </dl>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || Boolean(off) || !status.data} onClick={() => void getFunds()}>
            <Icon name="coins" size={16} />{busy ? "Working…" : `Get test funds: ${status.data?.bnb ?? "10"} BNB${status.data?.usdc ? ` + ${Number(status.data.usdc).toLocaleString("en-US")} dUSDC` : ""}`}
          </button>
          {msg ? <Note tone={msg.tone} icon={msg.tone === "good" ? "check" : "alert"}>{msg.text}</Note> : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 className="d4">Swap dUSDC to BNB</h3><span className="tiny muted">Local PancakeSwap pool {status.data?.demoUsdcPair ? short(status.data.demoUsdcPair) : ""}</span></div>
        <div className="card-body stack">
          {!swap.ready ? <p className="small muted" style={{ margin: 0 }}>No dUSDC pool on this chain. scripts/dev-up.sh seeds one (scripts/dev-funds.sh).</p> : (
            <>
              <label style={{ display: "block" }}>
                <span className="label">dUSDC to swap</span>
                <div className="input-group">
                  <input className="field mono" inputMode="decimal" value={amount} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setAmount(v); void swap.quote(Number(v)).then(setQuote); }} />
                  <span className="unit">dUSDC</span>
                </div>
              </label>
              <p className="small muted" style={{ margin: 0 }}>{quote === null ? "The pool quotes as you type." : `About ${quote.toLocaleString("en-US", { maximumFractionDigits: 4 })} BNB from the pool (2% slippage limit).`}</p>
              <button className="btn btn-ghost btn-block" disabled={busy || !wallet.address || !(Number(amount) > 0)} onClick={() => void doSwap()}>Approve and swap</button>
            </>
          )}
        </div>
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>{status.data?.label ?? "Local test funds only."}</p>
    </main>
  );
}
