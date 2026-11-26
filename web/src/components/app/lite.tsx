"use client";

/*
 * Covenant Lite (the Four.meme path) on screen: the list section, the vault page's body and the create form for
 * /app/create?venue=fourmeme. Wiring only, in the app's existing components; the design pass restyles them.
 */
import Link from "next/link";
import { useState } from "react";
import { useConfig } from "wagmi";
import { useWallet } from "@/components/providers";
import { encodeForwardVaultData, launchLiteLocal, LITE_DEFAULTS, liteProblems, useLiteActions, useLiteCovenants, type LiteAction, type LiteFields, type LiteView } from "@/lib/chain/fourmeme";
import { addressOf } from "@/lib/chain/deployment";
import { useSource } from "@/lib/data/hooks";
import { duration } from "@/lib/covenant/time";
import { short } from "@/lib/format";
import { Icon } from "./icons";
import { Note, Skeleton } from "./ui";

const n4 = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 4 });
const STATE_LABEL: Record<LiteView["state"], string> = { ACTIVE: "Active", ABANDONED: "Abandoned", WOUND_DOWN: "Wound down" };

export function LiteList() {
  const { list, loading, launcher } = useLiteCovenants();
  if (!launcher) return null;
  return (
    <section className="stack" aria-label="Four.meme covenants">
      <div><h2 className="d3">Four.meme covenants <span className="faint mono" style={{ fontSize: 15 }}>{list.length}</span></h2>
        <p className="small muted" style={{ margin: "4px 0 0" }}>Covenant Lite: the founder&apos;s trading tax lands in a vault with a tap and an abandonment switch, through Four.meme&apos;s ForwardVault.</p></div>
      {loading ? <Skeleton h={120} /> : list.length === 0 ? <div className="card card-pad small muted">No Lite covenant on this chain yet.</div> : (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>Token</th><th>State</th><th className="r">Treasury</th><th className="r">Tax in</th><th className="r">Tap paid</th><th>Heartbeat</th></tr></thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.vault}>
                  <td><Link className="ink" href={`/app/lite/${l.vault}`} style={{ fontWeight: 550 }}>{l.name}</Link> <span className="tiny muted">${l.symbol}</span></td>
                  <td><span className={`chip ${l.state === "ACTIVE" ? "chip-good" : "chip-warn"}`}>{STATE_LABEL[l.state]}</span></td>
                  <td className="r mono">{n4(l.treasury)} BNB</td>
                  <td className="r mono">{n4(l.taxDispatched)}</td>
                  <td className="r mono">{n4(l.tapPaid)}</td>
                  <td className="small muted">{l.state !== "ACTIVE" ? "Treasury open to holders" : l.heartbeatDeadline > l.now ? `due in ${duration(l.heartbeatDeadline - l.now)}` : "Due now: anyone can open it"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LitePage({ vault }: { vault: string }) {
  const { list, loading, source } = useLiteCovenants();
  const wallet = useWallet();
  const act = useLiteActions();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [amount, setAmount] = useState("");
  const l = list.find((x) => x.vault.toLowerCase() === vault.toLowerCase());
  if (!l) return <main className="page page-narrow">{loading || source.mode === "checking" ? <Skeleton h={200} /> : <div className="card card-pad small muted">No Lite covenant at {short(vault)} on this chain.</div>}</main>;
  const isFounder = wallet.address?.toLowerCase() === l.owner.toLowerCase();
  const due = l.state === "ACTIVE" && l.now > l.heartbeatDeadline;
  async function go(a: LiteAction, tokens?: number) {
    if (!wallet.address) { wallet.connect(); return; }
    setBusy(true); setMsg(null);
    try { const h = await act.run(l!, a, tokens); setMsg({ tone: "good", text: `${a} confirmed (${short(h)}).` }); }
    catch (e) { setMsg({ tone: "warn", text: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message }); }
    finally { setBusy(false); }
  }
  return (
    <main className="page">
      <div style={{ display: "grid", gap: 6 }}>
        <p className="eyebrow">Four.meme path · Covenant Lite</p>
        <h1 className="d2">{l.name} <span className="soft">${l.symbol}</span></h1>
        <p className="small muted" style={{ margin: 0 }}>Token {short(l.token)} · ForwardVault {short(l.forwardVault)} · Lite vault {short(l.vault)} · founder {short(l.owner)}</p>
      </div>
      <div className="grid2">
        <div className="card card-pad stack">
          <div className="row between"><span className="d4">Treasury</span><span className={`chip ${l.state === "ACTIVE" ? "chip-good" : "chip-warn"}`}>{STATE_LABEL[l.state]}</span></div>
          <div className="mono" style={{ fontSize: 30 }}>{n4(l.treasury)} BNB</div>
          <dl className="kv">
            <dt>Founder tax forwarded</dt><dd>{n4(l.taxDispatched)} BNB (6% royalty to the template author)</dd>
            <dt>Tax waiting in the token</dt><dd>{n4(l.pendingTax)} {l.symbol}</dd>
            <dt>Tap</dt><dd>{l.params.tapBps / 100}% of the treasury per {duration(l.params.tapPeriod)}</dd>
            <dt>Tap paid / available now</dt><dd>{n4(l.tapPaid)} / {n4(l.tapAvailable)} BNB</dd>
            <dt>Heartbeat</dt><dd>{duration(l.params.heartbeat)} window · {l.state !== "ACTIVE" ? "closed" : due ? "lapsed" : `due in ${duration(l.heartbeatDeadline - l.now)}`}</dd>
            <dt>Redeem fee</dt><dd>{l.params.redeemFeeBps / 100}%</dd>
            <dt>Tokens burned</dt><dd>{n4(l.tokensBurned)}</dd>
          </dl>
        </div>
        <div className="card card-pad stack">
          <span className="d4">Actions</span>
          {l.pendingTax > 0 ? <button className="btn btn-ghost" disabled={busy} onClick={() => void go("dispatch")}>Dispatch pending tax to the vault</button> : null}
          {l.state === "ACTIVE" ? (
            <>
              <button className="btn btn-ghost" disabled={busy || !isFounder} onClick={() => void go("withdrawTap")} title={isFounder ? "" : "Founder only"}>Withdraw tap ({n4(l.tapAvailable)} BNB)</button>
              <button className="btn btn-ghost" disabled={busy || !isFounder} onClick={() => void go("heartbeat")}>Send heartbeat</button>
              <button className="btn btn-ghost" disabled={busy || !isFounder} onClick={() => void go("windDown")}>Wind down</button>
              <button className="btn btn-danger" disabled={busy || !due} onClick={() => void go("declareAbandoned")} title={due ? "Anyone can press it" : "Only after the heartbeat window"}>Declare abandoned</button>
            </>
          ) : (
            <>
              <label><span className="label">Tokens to burn{l.balance !== undefined ? <span className="hint">you hold {n4(l.balance)}</span> : null}</span>
                <input className="field mono" inputMode="decimal" value={amount} placeholder={l.balance ? String(Math.floor(l.balance)) : "0"} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></label>
              <button className="btn btn-primary" disabled={busy || !(Number(amount || l.balance || 0) > 0)} onClick={() => void go("redeem", Number(amount || Math.floor(l.balance ?? 0)))}>Redeem pro rata</button>
            </>
          )}
          {msg ? <Note tone={msg.tone} icon={msg.tone === "good" ? "check" : "alert"}>{msg.text}</Note> : null}
          {!wallet.address ? <p className="tiny muted" style={{ margin: 0 }}>Connect a wallet to act.</p> : null}
        </div>
      </div>
    </main>
  );
}

/** /app/create?venue=fourmeme: the four Lite fields, the exact ForwardVault bytes, and the local launch. */
export function FourmemeCreate() {
  const src = useSource();
  const wallet = useWallet();
  const config = useConfig();
  const [f, setF] = useState<LiteFields>(LITE_DEFAULTS);
  const [t, setT] = useState({ name: "", symbol: "", supply: 1_000_000_000, taxBps: 500, poolTokens: 300_000_000, poolBnb: 20 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const d = src.payload?.deployment;
  const template = d ? addressOf(d, "liteVaultTemplate") : undefined;
  const launcher = d ? addressOf(d, "fourLiteLauncher") : undefined;
  const problems = liteProblems(f);
  const data = template && problems.length === 0 ? encodeForwardVaultData(template, f) : null;
  const num = (k: keyof LiteFields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: Number(e.target.value.replace(/[^0-9]/g, "")) }));
  async function launch() {
    if (!wallet.address) { wallet.connect(); return; }
    if (!launcher || !template || !src.chainId) return;
    setBusy(true); setMsg(null);
    try {
      const h = await launchLiteLocal(config, src.chainId, launcher, template, t, f);
      setMsg({ tone: "good", text: `Launched on the local chain (${short(h)}). It is listed under Four.meme covenants.` });
    } catch (e) { setMsg({ tone: "warn", text: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message }); }
    finally { setBusy(false); }
  }
  return (
    <main className="page page-narrow">
      <div style={{ display: "grid", gap: 8 }}>
        <p className="eyebrow">Create · Four.meme path</p>
        <h1 className="d1">Covenant Lite. <span className="soft">The founder&apos;s tax goes to a vault with a tap and a switch.</span></h1>
      </div>
      <div className="card card-pad stack">
        <span className="d4">Lite terms (the four fields)</span>
        <div className="grid2">
          <label><span className="label">Tap per period <span className="hint">bps of the treasury, 1 to 5000</span></span><input className="field mono" value={f.tapBps} onChange={num("tapBps")} /></label>
          <label><span className="label">Tap period <span className="hint">seconds, 1 to 90 days</span></span><input className="field mono" value={f.tapPeriod} onChange={num("tapPeriod")} /></label>
          <label><span className="label">Heartbeat <span className="hint">seconds, 7 to 180 days</span></span><input className="field mono" value={f.heartbeat} onChange={num("heartbeat")} /></label>
          <label><span className="label">Redeem fee <span className="hint">bps, at most 300</span></span><input className="field mono" value={f.redeemFeeBps} onChange={num("redeemFeeBps")} /></label>
        </div>
        {problems.length ? <Note tone="warn" icon="alert">{problems.join(". ")}</Note> : null}
        <div>
          <span className="label">ForwardVault vault data <span className="hint">tuple (template, initData), as the live ForwardVault decodes it</span></span>
          <textarea className="field mono" readOnly rows={4} value={data ?? (template ? "" : "No Lite template in this deployment")} style={{ width: "100%", fontSize: 12 }} />
          <p className="tiny muted" style={{ margin: "6px 0 0" }}>On Four.meme, pick the tax vault template {template ? short(template) : ""} and paste these bytes. The flat encoding in Four.meme&apos;s docs reverts on the live ForwardVault.</p>
        </div>
      </div>
      <div className="card card-pad stack">
        <span className="d4">Launch it on the local chain</span>
        {!launcher ? <p className="small muted" style={{ margin: 0 }}>No local launcher here: OpenFour&apos;s ForwardVault runs only on BNB Chain, so this needs the fork (scripts/dev-all.sh --fork).</p> : (
          <>
            <p className="small muted" style={{ margin: 0 }}>A local stand-in for Four.meme&apos;s token creation (which needs Four.meme&apos;s backend): one transaction deploys a tax token, clones the live ForwardVault onto the Lite template with the bytes above, and seeds a PancakeSwap pool.</p>
            <div className="grid2">
              <label><span className="label">Name</span><input className="field" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></label>
              <label><span className="label">Symbol</span><input className="field mono" value={t.symbol} onChange={(e) => setT({ ...t, symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })} /></label>
              <label><span className="label">Trading tax <span className="hint">bps, at most 1000</span></span><input className="field mono" value={t.taxBps} onChange={(e) => setT({ ...t, taxBps: Number(e.target.value.replace(/[^0-9]/g, "")) })} /></label>
              <label><span className="label">Pool seed <span className="hint">BNB</span></span><input className="field mono" value={t.poolBnb} onChange={(e) => setT({ ...t, poolBnb: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} /></label>
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || !data || !t.name || !t.symbol || t.taxBps > 1000 || !(t.poolBnb > 0)} onClick={() => void launch()}><Icon name="sparkle" size={16} />{busy ? "Launching…" : "Launch with Covenant Lite"}</button>
          </>
        )}
        {msg ? <Note tone={msg.tone} icon={msg.tone === "good" ? "check" : "alert"}>{msg.text}</Note> : null}
      </div>
    </main>
  );
}
