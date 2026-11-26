"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@/components/app/icons";
import { ConnectChain, CopyCode } from "@/components/app/live";
import { Addr, Note, Skeleton, Ticker, TokenAvatar, cx } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { chainName } from "@/lib/chain/chains";
import { useSource } from "@/lib/data/hooks";
import { requestFunds, useBalances, useFaucetStatus, useSwap } from "@/lib/data/faucet";
import { short } from "@/lib/format";
import { BnbCoin, withBnb } from "@/components/app/bnb";
import { ThinkingMark } from "@/components/app/mark";

/*
 * Get test funds: local dev chain only. The server sends test BNB from an anvil account and mints Demo USDC; the
 * swap trades dUSDC for BNB on the local PancakeSwap pool. Covenant raises stay BNB-quoted; dUSDC never enters a vault.
 */
export default function FaucetPage() {
  const src = useSource();
  return (
    <main className="page">
      <div className="sec-head">
        <div className="stack-sm" style={{ display: "grid", maxWidth: 700 }}>
          <span className="eyebrow">Local chain · test funds</span>
          <h1 className="h-page">Get test funds</h1>
          <p className="lede">For the local dev chain only, worthless anywhere else. Test BNB from one of anvil&apos;s public accounts and Demo USDC minted by the dev stack, sent to the connected wallet. Raises are in BNB, as Flap requires; dUSDC funds a wallet and swaps to BNB on the local PancakeSwap pool.</p>
        </div>
      </div>
      {src.mode === "live" ? <Funds /> : <ConnectChain source={src} />}
    </main>
  );
}

function Funds() {
  const src = useSource();
  const wallet = useWallet();
  const qc = useQueryClient();
  const status = useFaucetStatus();
  const bal = useBalances(status.data?.demoUsdc);
  const swap = useSwap(status.data);
  const block = useQuery({ queryKey: ["block", src.chainId], enabled: Boolean(src.client), refetchInterval: 3_000, queryFn: async () => Number(await src.client!.getBlockNumber()) });
  const [busy, setBusy] = useState<"funds" | "swap" | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [amount, setAmount] = useState("1000");
  const [quote, setQuote] = useState<number | null>(null);

  async function getFunds() {
    if (!wallet.address) { wallet.connect(); return; }
    setBusy("funds"); setMsg(null);
    try {
      const r = await requestFunds(wallet.address);
      setMsg({ tone: "good", text: `Sent ${Number(r.bnbWei) / 1e18} test BNB (${short(r.bnbTx)})${r.usdc ? ` and minted ${Number(r.usdc).toLocaleString("en-US")} dUSDC (${short(r.usdcTx ?? "")})` : ""} on the local chain.` });
      await qc.invalidateQueries({ queryKey: ["balances"] });
    } catch (e) {
      setMsg({ tone: "warn", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function doSwap() {
    if (!wallet.address) { wallet.connect(); return; }
    setBusy("swap"); setMsg(null);
    try {
      const h = await swap.swap(Number(amount));
      setMsg({ tone: "good", text: `Swapped ${Number(amount).toLocaleString("en-US")} dUSDC for BNB on the local PancakeSwap pool (${short(h)}).` });
    } catch (e) {
      setMsg({ tone: "warn", text: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const off = status.isError ? `The Covenant server did not answer (${(status.error as Error).message}). Start the stack with scripts/dev-all.sh.` : status.data && !status.data.enabled ? status.data.reason : null;
  const usdcOut = status.data?.usdc ? Number(status.data.usdc) : null;

  return (
    <div className="grid-side">
      <div className="stack">
        <div className="mint rise">
          <div className="mint-top">
            <div className="row between wrap-ok">
              <div className="row" style={{ gap: 14 }}>
                <BnbCoin size={56} />
                <div><div className="h-card">Your wallet</div><div className="t-xs muted w5">{src.chainId ? withBnb(chainName(src.chainId)) : "Local chain"} · local dev chain</div></div>
              </div>
              {wallet.address ? <span className="row" style={{ gap: 10 }}><TokenAvatar seed={wallet.address} size={32} /><Addr a={wallet.address} /></span> : null}
            </div>
            {!wallet.address ? (
              <div className="row wrap-ok between"><span className="t-s muted w5">Connect a wallet or a local test account to receive funds.</span><button className="btn btn-primary" onClick={() => wallet.connect()}><Icon name="wallet" size={15} />Connect</button></div>
            ) : bal.isLoading ? <Skeleton h={64} /> : (
              <div className="row wrap-ok" style={{ gap: 36, alignItems: "flex-end" }}>
                <div style={{ display: "grid", gap: 4 }}><span className="lbl">BNB</span><span className="mint-bal">{bal.data ? <Ticker value={bal.data.bnb} format={(n) => n.toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 2 })} /> : "–"}</span></div>
                <div style={{ display: "grid", gap: 4 }}><span className="lbl">dUSDC <span className="faint">local test token</span></span><span className="mint-bal" style={{ fontSize: 30 }}>{bal.data?.usdc === null || bal.data?.usdc === undefined ? <span className="t-s muted">not deployed</span> : <Ticker value={bal.data.usdc} format={(n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })} />}</span></div>
              </div>
            )}
          </div>
          <div className="mint-body">
            {off ? <Note tone="warn">{off}</Note> : null}
            <div>
              <span className="label">You receive</span>
              <div className="mint-amts" style={{ gridTemplateColumns: usdcOut ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }}>
                <div className="mint-get"><BnbCoin size={36} /><span><b className="num">{status.data?.bnb ?? "–"}</b><span>test BNB from an anvil account</span></span></div>
                {usdcOut ? <div className="mint-get"><span className="mint-coin sm usdc">$</span><span><b className="num">{usdcOut.toLocaleString("en-US")}</b><span>Demo USDC, minted</span></span></div> : null}
              </div>
            </div>
            <button className="btn btn-primary btn-xl btn-block" disabled={busy !== null || Boolean(off) || !status.data} onClick={() => void getFunds()}>
              {busy === "funds" ? <><ThinkingMark size={16} />Sending…</> : !wallet.address ? <><Icon name="wallet" size={16} />Connect to get test funds</> : <><Icon name="drop" size={16} />Get test funds</>}
            </button>
            {msg ? <div className={msg.tone === "good" ? "mint-ok" : "mint-err"} role={msg.tone === "good" ? "status" : "alert"}><Icon name={msg.tone === "good" ? "check" : "alert"} size={16} /><span className="anywhere">{msg.text}</span></div> : null}
          </div>
        </div>

        <div className="card rise" style={{ ["--i" as string]: 1 }}>
          <div className="card-head ruled"><div><h2 className="h-card">Swap dUSDC to BNB</h2><p className="t-xs muted w5">Local PancakeSwap pool {status.data?.demoUsdcPair ? short(status.data.demoUsdcPair) : ""}</p></div></div>
          <div className="card-body ruled stack">
            {!swap.ready ? <p className="t-s muted w5">No dUSDC pool on this chain. <span className="mono">scripts/dev-up.sh</span> seeds one (<span className="mono">scripts/dev-funds.sh</span>).</p> : (
              <>
                <div className="swap">
                  <div className="swap-box">
                    <div className="row between t-s w5"><span className="muted">You pay</span>{bal.data?.usdc != null ? <span className="muted">Balance <span className="num ink">{bal.data.usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></span> : null}</div>
                    <div className="row" style={{ gap: 12 }}>
                      <input className="amt" inputMode="decimal" value={amount} aria-label="dUSDC to swap" onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setAmount(v); void swap.quote(Number(v)).then(setQuote); }} />
                      <span className="tokchip"><span className="mint-coin sm usdc">$</span>dUSDC</span>
                    </div>
                  </div>
                  <span className="swap-arrow" aria-hidden><Icon name="down" size={16} /></span>
                  <div className="swap-box">
                    <div className="row between t-s w5"><span className="muted">You receive about</span><span className="muted">2% slippage limit</span></div>
                    <div className="row" style={{ gap: 12 }}>
                      <span className={cx("amt", quote === null && "faint")} style={{ display: "block" }}>{quote === null ? "–" : quote.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
                      <span className="tokchip"><BnbCoin size={28} />BNB</span>
                    </div>
                  </div>
                </div>
                <p className="t-xs muted w5">{quote === null ? "The pool quotes as you type." : "Quoted by the local pool's router."}</p>
                <button className="btn btn-secondary btn-lg btn-block" disabled={busy !== null || !wallet.address || !(Number(amount) > 0)} onClick={() => void doSwap()}>{busy === "swap" ? <><ThinkingMark size={16} />Swapping…</> : <><Icon name="swap" size={15} />Approve and swap</>}</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="stack sticky">
        <div className="card">
          <div className="card-head ruled"><h2 className="h-card">The chain you are on</h2><span className="badge good"><span className="dot pulse" />Live</span></div>
          <div className="card-body ruled">
            <dl className="kv">
              <dt>Network</dt><dd>{src.chainId ? withBnb(chainName(src.chainId)) : "–"}</dd>
              <dt>Chain id</dt><dd className="num">{src.chainId ?? "–"}</dd>
              <dt>Block</dt><dd className="num">{block.data !== undefined ? block.data.toLocaleString("en-US") : "–"}</dd>
              <dt>Faucet</dt><dd>{status.isLoading ? "Checking" : off ? "Off" : "Ready"}</dd>
            </dl>
          </div>
        </div>
        <div className="card card-pad stack-sm" style={{ display: "grid" }}>
          <h2 className="h-card">Then</h2>
          <p className="t-s muted w5">Commit to a raise, claim your tokens at settlement and redeem at book when a round opens. The issuer agents and keeper run against the same chain.</p>
          <p className="t-xs muted w5">{status.data?.label ?? "Local test funds only."} Restarting the stack resets balances:</p>
          <CopyCode text="scripts/dev-all.sh" />
        </div>
      </div>
    </div>
  );
}
