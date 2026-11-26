"use client";

/*
 * Covenant Lite (the Four.meme path) on screen: the list section, the vault page and the create path for
 * /app/create?venue=fourmeme. Wiring from lib/chain/fourmeme.ts (the live ForwardVault's tuple encoding, the
 * dev chain's FourLiteLauncher, the vault reads and actions), presented in the app's design language.
 */
import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useConfig } from "wagmi";
import { useWallet } from "@/components/providers";
import { encodeForwardVaultData, launchLiteLocal, LITE_DEFAULTS, liteProblems, useLiteActions, useLiteCovenants, type LiteAction, type LiteFields, type LiteView } from "@/lib/chain/fourmeme";
import { addressOf } from "@/lib/chain/deployment";
import { useSource } from "@/lib/data/hooks";
import { duration, span } from "@/lib/covenant/time";
import { short, tokens } from "@/lib/format";
import { chainName } from "@/lib/chain/chains";
import { LOCAL_MODE } from "@/lib/chain/target";
import { BnbCoin } from "./bnb";
import { ConfirmAction } from "./confirm";
import { Icon, type IconName } from "./icons";
import { ConnectChain, CopyCode } from "./live";
import { ThinkingMark } from "./mark";
import { Addr, Empty, Meter, Note, SecHead, TokenAvatar, cx, useCountdown } from "./ui";

const n4 = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 4 });
const DAY = 86_400;
const STATE: Record<LiteView["state"], { label: string; tone: "good" | "bad" }> = { ACTIVE: { label: "Active", tone: "good" }, ABANDONED: { label: "Abandoned", tone: "bad" }, WOUND_DOWN: { label: "Wound down", tone: "bad" } };

function LiteState({ s }: { s: LiteView["state"] }) {
  return <span className={cx("badge", STATE[s].tone)}>{STATE[s].label}</span>;
}

/* ---------- List ---------- */

export function LiteList() {
  const { list, loading, launcher } = useLiteCovenants();
  if (!launcher) return null;
  return (
    <section className="stack sect" aria-label="Four.meme covenants">
      <SecHead title={<>Four.meme covenants <span className="muted num" style={{ fontSize: 15 }}>{list.length}</span></>} sub="Covenant Lite: the founder's trading tax lands in a vault with a budget cap and an abandonment switch, through Four.meme's ForwardVault." right={<Link className="btn btn-secondary btn-sm" href="/app/create?venue=fourmeme"><Icon name="plus" size={14} />Launch on Four.meme</Link>} />
      {loading ? <p className="loading-line"><ThinkingMark size={16} />Reading the Lite vaults…</p> : list.length === 0 ? (
        <div className="card"><Empty title="No Lite covenant on this chain yet" icon="coins">A Four.meme tax token gets one when its founder picks the Covenant Lite template.</Empty></div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Token</th><th>State</th><th className="r">Treasury</th><th className="r hide-sm">Tax in</th><th className="r hide-sm">Tap paid</th><th>Heartbeat</th></tr></thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.vault}>
                  <td><Link href={`/app/lite/${l.vault}`} className="row" style={{ gap: 12 }}><TokenAvatar seed={l.token} size={32} /><span style={{ display: "grid" }}><span className="ink">{l.name}</span><span className="mono t-xs muted">${l.symbol}</span></span></Link></td>
                  <td><LiteState s={l.state} /></td>
                  <td className="r ink">{n4(l.treasury)} <BnbCoin size="0.95em" /></td>
                  <td className="r hide-sm">{n4(l.taxDispatched)}</td>
                  <td className="r hide-sm">{n4(l.tapPaid)}</td>
                  <td className={cx("t-s", l.state === "ACTIVE" && l.heartbeatDeadline <= l.now ? "warn-t" : "muted")} style={{ whiteSpace: "nowrap" }}>{l.state !== "ACTIVE" ? "Treasury open to holders" : l.heartbeatDeadline > l.now ? `Due in ${duration(l.heartbeatDeadline - l.now)}` : "Due now"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Vault page ---------- */

export function LitePage({ vault }: { vault: string }) {
  const { list, loading, source } = useLiteCovenants();
  const wallet = useWallet();
  const act = useLiteActions();
  const [busy, setBusy] = useState<LiteAction | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState<"windDown" | "declareAbandoned" | null>(null);
  const l = list.find((x) => x.vault.toLowerCase() === vault.toLowerCase());
  const hbLeft = useCountdown(l ? Math.max(0, l.heartbeatDeadline - l.now) : 0);
  if (source.mode !== "live") return <main className="page"><ConnectChain source={source} /></main>;
  if (!l) return <main className="page page-narrow">{loading ? <p className="loading-line"><ThinkingMark size={16} />Reading the Lite vault…</p> : <div className="card"><Empty title="No Lite covenant at this address" icon="search" action={<Link className="btn btn-secondary btn-sm" href="/app/covenants">See all covenants</Link>}>Nothing at {short(vault)} on this chain.</Empty></div>}</main>;
  const isFounder = wallet.address?.toLowerCase() === l.owner.toLowerCase();
  const due = l.state === "ACTIVE" && l.now > l.heartbeatDeadline;
  const used = Math.max(0, l.params.heartbeat - Math.max(0, l.heartbeatDeadline - l.now));
  async function go(a: LiteAction, tokens?: number) {
    if (!wallet.address) { wallet.connect(); return; }
    setBusy(a); setMsg(null);
    try { const h = await act.run(l!, a, tokens); setMsg({ tone: "good", text: `${a} confirmed (${short(h)}).` }); }
    catch (e) { setMsg({ tone: "warn", text: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message }); }
    finally { setBusy(null); }
  }
  const strip = l.state !== "ACTIVE"
    ? { tone: "bad", icon: "vault" as IconName, title: `${STATE[l.state].label}: treasury open to holders`, sub: <>Burn tokens for a pro rata share of the vault, less the {l.params.redeemFeeBps / 100}% fee. <span className="num">{tokens(l.tokensBurned)}</span> {l.symbol} burned so far.</> }
    : due ? { tone: "warn", icon: "heart" as IconName, title: "Abandonment is due", sub: <>The founder has been silent past the {span(l.params.heartbeat)} window. Anyone can open the treasury to holders.</> }
    : { tone: "good", icon: "shieldCheck" as IconName, title: "Budget cap and switch armed", sub: <>Heartbeat due in <span className="num">{duration(hbLeft, 2)}</span>. The founder can draw at most {l.params.tapBps / 100}% of the treasury per {span(l.params.tapPeriod)}.</> };

  return (
    <main>
      <div className="wrap">
        <div className="chead">
          <div className="chead-id">
            <TokenAvatar seed={l.token} size={48} />
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <div className="name"><span className="h-page">{l.name}</span><span className="muted w5">${l.symbol}</span></div>
              <div className="row wrap-ok" style={{ gap: 12 }}><LiteState s={l.state} /><span className="badge"><Icon name="coins" size={13} />Covenant Lite · Four.meme</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="page" style={{ paddingTop: 4 }}>
        <section aria-label="Overview">
          <div className={`strip ${strip.tone}`} role="status">
            <span className="strip-ic"><Icon name={strip.icon} size={19} /></span>
            <div className="strip-txt"><b>{strip.title}</b><span>{strip.sub}</span></div>
            {due ? <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => setConfirm("declareAbandoned")}>Declare now</button> : null}
          </div>
          <div className="hgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="hcell rise">
              <span className="lbl">Treasury</span>
              <div className="fig-xl"><span className="num">{n4(l.treasury)}</span><span className="u bnb-u"><BnbCoin size="0.95em" />BNB</span></div>
              <dl className="kv"><dt>Founder tax forwarded</dt><dd className="num">{n4(l.taxDispatched)} BNB</dd><dt>Tax waiting in the token</dt><dd className="num">{n4(l.pendingTax)} {l.symbol}</dd></dl>
              <p className="t-xs muted w5">ForwardVault keeps a 6% royalty for the template author before forwarding.</p>
            </div>
            <div className="hcell rise" style={{ ["--i" as string]: 1 } as CSSProperties}>
              <span className="lbl">Budget cap</span>
              <div className="fig-md"><span className="num">{l.params.tapBps / 100}%</span><span className="u">per {span(l.params.tapPeriod)}</span></div>
              <Meter value={l.tapPaid} max={Math.max(l.tapPaid + l.tapAvailable, 1e-12)} label="Tap paid against paid plus available" />
              <dl className="kv"><dt>Paid</dt><dd className="num">{n4(l.tapPaid)} BNB</dd><dt>Available now</dt><dd className="num">{n4(l.tapAvailable)} BNB</dd></dl>
            </div>
            <div className="hcell rise" style={{ ["--i" as string]: 2 } as CSSProperties}>
              <span className="lbl">Abandonment switch</span>
              <div className={cx("fig-md", due && "warn-t")}><span className="num">{l.state !== "ACTIVE" ? "Switched" : due ? "Due" : duration(hbLeft, 2)}</span></div>
              <Meter value={l.state !== "ACTIVE" ? 1 : used} max={l.state !== "ACTIVE" ? 1 : l.params.heartbeat} tone={l.state !== "ACTIVE" ? "bad" : due ? "warn" : "good"} label="Heartbeat window used" />
              <p className="t-xs muted w5">{span(l.params.heartbeat)} window · last heartbeat {duration(Math.max(0, l.now - l.lastHeartbeat), 1)} ago</p>
            </div>
            <div className="hcell rise" style={{ ["--i" as string]: 3 } as CSSProperties}>
              <span className="lbl">Redemption</span>
              <div className="fig-md"><span className="num">{l.params.redeemFeeBps / 100}%</span><span className="u">fee, kept for holders</span></div>
              <dl className="kv"><dt>Tokens burned</dt><dd className="num">{tokens(l.tokensBurned)}</dd><dt>Redeemable supply</dt><dd className="num">{tokens(l.redeemableSupply)}</dd></dl>
            </div>
          </div>
        </section>

        <div className="grid-side" style={{ columnGap: 36 }}>
          <div className="card">
            <div className="card-head ruled"><h2 className="h-card">{l.state === "ACTIVE" ? "Actions" : "Redeem pro rata"}</h2>{!wallet.address ? <span className="t-xs muted w5">Connect a wallet to act</span> : isFounder ? <span className="badge good">Founder connected</span> : null}</div>
            <div className="card-body ruled stack">
              {l.pendingTax > 0 ? <button className="btn btn-secondary btn-block" disabled={busy !== null} onClick={() => void go("dispatch")}>{busy === "dispatch" ? <ThinkingMark size={15} /> : <Icon name="down" size={15} />}Dispatch pending tax to the vault</button> : null}
              {l.state === "ACTIVE" ? (
                <>
                  <div className="grid2" style={{ gap: 8 }}>
                    <button className="btn btn-primary" disabled={busy !== null || !isFounder} onClick={() => void go("withdrawTap")} title={isFounder ? "" : "Founder only"}>{busy === "withdrawTap" ? <ThinkingMark size={15} /> : <Icon name="coins" size={15} />}Withdraw {n4(l.tapAvailable)} BNB</button>
                    <button className="btn btn-secondary" disabled={busy !== null || !isFounder} onClick={() => void go("heartbeat")} title={isFounder ? "" : "Founder only"}>{busy === "heartbeat" ? <ThinkingMark size={15} /> : <Icon name="heart" size={15} />}Send heartbeat</button>
                  </div>
                  <button className="btn btn-danger-soft btn-block" disabled={busy !== null || !isFounder} onClick={() => setConfirm("windDown")}>Wind down…</button>
                  {!isFounder && wallet.address ? <p className="t-xs muted w5">Tap, heartbeat and wind-down are the founder&apos;s ({short(l.owner)}). Anyone can declare abandonment once the window lapses.</p> : null}
                </>
              ) : (
                <>
                  <div className="swap-box">
                    <div className="row between t-s w5"><span className="muted">You burn</span>{l.balance !== undefined ? <span className="muted">You hold <span className="num ink">{n4(l.balance)}</span></span> : null}</div>
                    <div className="row" style={{ gap: 12 }}>
                      <input className="amt" inputMode="decimal" value={amount} placeholder={l.balance ? String(Math.floor(l.balance)) : "0"} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label={`Tokens to burn, ${l.symbol}`} />
                      <span className="tokchip"><TokenAvatar seed={l.token} size={28} />{l.symbol}</span>
                    </div>
                  </div>
                  <button className="btn btn-accent btn-lg btn-block" disabled={busy !== null || !(Number(amount || l.balance || 0) > 0)} onClick={() => void go("redeem", Number(amount || Math.floor(l.balance ?? 0)))}>{busy === "redeem" ? <ThinkingMark size={15} /> : <Icon name="redeem" size={15} />}Redeem pro rata</button>
                </>
              )}
              {msg ? <div className={msg.tone === "good" ? "mint-ok" : "mint-err"} role={msg.tone === "good" ? "status" : "alert"}><Icon name={msg.tone === "good" ? "check" : "alert"} size={16} /><span className="anywhere">{msg.text}</span></div> : null}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2 className="h-card">Contracts</h2></div>
            <div className="alist" style={{ borderTop: "1px solid var(--line)" }}>
              {([["Token", l.symbol, l.token], ["ForwardVault", "Four.meme's founder recipient", l.forwardVault], ["Lite vault", "Covenant Lite clone", l.vault], ["Pool", "PancakeSwap pair", l.pair], ["Founder", "Owner of the vault", l.owner]] as [string, string, string][]).map(([k, s, a]) => (
                <div key={k}><div className="who"><b>{k}</b><span>{s}</span></div><span className="addr-pill"><Addr a={a} chainId={source.chainId} /></span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ConfirmAction open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => { const a = confirm!; setConfirm(null); void go(a); }}
        title={confirm === "windDown" ? `Wind down ${l.name}?` : `Declare ${l.name} abandoned?`} confirmLabel={confirm === "windDown" ? "Wind down for good" : "Declare abandoned"} icon={confirm === "windDown" ? "vault" : "heart"}
        lead={confirm === "windDown" ? "The founder closes honestly: the vault opens to holders and stays open." : <>The founder has been silent past the {span(l.params.heartbeat)} window. This opens the vault to holders for good.</>}
        points={[
          { icon: "coins", text: "The budget stops. The founder draws nothing more." },
          { icon: "redeem", text: <>Holders burn tokens for a pro rata share of the vault, less the {l.params.redeemFeeBps / 100}% fee kept for those who stay.</> },
          { icon: "lock", text: "It cannot be undone." },
        ]}
        gas={confirm === "windDown" ? "Only the founder's wallet can send this, and it pays the network fee (gas)." : "Anyone can send this. The wallet you send it from pays the network fee (gas); nothing comes out of the vault."} />
    </main>
  );
}

/* ---------- Create: /app/create?venue=fourmeme ---------- */

const pct = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

/** The four Lite fields in plain words, the exact ForwardVault bytes to paste on Four.meme, and the local launch. */
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
  const setF2 = <K extends keyof LiteFields>(k: K, v: number) => setF((x) => ({ ...x, [k]: v }));
  const periods = (months: number) => (months * 30 * DAY) / Math.max(1, f.tapPeriod);
  const left = (months: number) => Math.pow(1 - f.tapBps / 10_000, periods(months));
  const per30 = 1 - Math.pow(1 - f.tapBps / 10_000, (30 * DAY) / Math.max(1, f.tapPeriod));
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
    <div className="grid-side">
      <div className="stack">
        <div className="card">
          <div className="card-head ruled">
            <div className="row" style={{ gap: 12 }}><span className="icon-tile accent"><Icon name="shield" size={17} /></span><div><h2 className="h-card">Covenant Lite terms</h2><p className="t-xs muted w5">Rules 1 and 4 on the founder&apos;s share of trading tax: a budget cap and the abandonment switch.</p></div></div>
          </div>
          <div className="card-body ruled form-step">
            <LField label="Budget per period" hint="share of the treasury the founder can draw" value={pct(f.tapBps)}>
              <input className="range" type="range" min={50} max={2000} step={50} value={Math.min(2000, f.tapBps)} onChange={(e) => setF2("tapBps", Number(e.target.value))} aria-label="Budget per period, basis points" style={{ ["--fill" as string]: `${((Math.min(2000, f.tapBps) - 50) / 1950) * 100}%` } as CSSProperties} />
              <span className="help">Up to 50% is allowed. Template field <span className="mono">tapBps</span> = {f.tapBps}.</span>
            </LField>
            <div className="grid2">
              <LField label="Period length" hint="1 to 90 days" value={span(f.tapPeriod)}><LNum value={f.tapPeriod / DAY} unit="days" onChange={(n) => setF2("tapPeriod", Math.round(n * DAY))} /></LField>
              <LField label="Heartbeat window" hint="7 to 180 days" value={span(f.heartbeat)}><LNum value={f.heartbeat / DAY} unit="days" onChange={(n) => setF2("heartbeat", Math.round(n * DAY))} /></LField>
            </div>
            <LField label="Redeem fee" hint="kept for holders who stay, at most 3%" value={pct(f.redeemFeeBps)}><LNum value={f.redeemFeeBps / 100} unit="%" onChange={(n) => setF2("redeemFeeBps", Math.round(n * 100))} /></LField>
            <div className="tile stack-sm" style={{ display: "grid" }}>
              <span className="lbl">What the founder can draw</span>
              <p className="t-s ink2 w5">At most <b className="num ink">{pct(f.tapBps)}</b> of the treasury every <b className="num ink">{span(f.tapPeriod)}</b>, about <b className="num ink">{(per30 * 100).toFixed(1)}%</b> a month. Each claim counts as a heartbeat.</p>
              {[3, 6, 12].map((m) => <div key={m} className="floor-row"><span className="muted">{m} months</span><Meter size="sm" value={left(m)} max={1} /><span className="num ink" style={{ textAlign: "right" }}>{(left(m) * 100).toFixed(0)}%</span></div>)}
              <p className="t-xs muted w5">Share of the treasury left if the founder draws the full budget every period and no tax comes in.</p>
            </div>
            {problems.length ? <ul className="problems">{problems.map((x) => <li key={x}><Icon name="alert" size={13} />{x}</li>)}</ul> : null}
          </div>
        </div>

        {!LOCAL_MODE ? (
          <div className="card">
            <div className="card-head ruled"><div><h2 className="h-card">Create the token on Four.meme</h2><p className="t-xs muted w5">Four.meme&apos;s create page makes the token and signs each launch on its own servers.</p></div></div>
            <div className="card-body ruled stack">
              <p className="t-s muted w5">Pick the Covenant Lite template when you create a tax token on Four.meme, and paste the vault data on the right. The founder&apos;s tax then goes to a Lite vault with these terms, and the token is listed here as a Four.meme covenant.</p>
              <Note icon="info">Four.meme does not create tokens on {chainName(97)} yet, so this path runs on BNB Chain once it opens there. The Lite template is already deployed and verified on {chainName(97)}{template ? <> at <span className="mono">{short(template)}</span></> : null}.</Note>
            </div>
          </div>
        ) : (
        <div className="card">
          <div className="card-head ruled"><div><h2 className="h-card">Launch it on the local chain</h2><p className="t-xs muted w5">A stand-in for Four.meme&apos;s token creation, which needs Four.meme&apos;s backend.</p></div></div>
          <div className="card-body ruled stack">
            {src.mode !== "live" ? <ConnectChain source={src} /> : !launcher ? <Note icon="info">No local launcher here: OpenFour&apos;s ForwardVault runs only on BNB Chain, so this needs the fork (<span className="mono">scripts/dev-all.sh --fork</span>).</Note> : (
              <>
                <p className="t-s muted w5">One transaction deploys a tax token, clones the live ForwardVault onto the Lite template with the bytes on the right, and seeds a PancakeSwap pool.</p>
                <div className="grid2">
                  <label><span className="label">Name</span><input className="field" value={t.name} placeholder="Forge" onChange={(e) => setT({ ...t, name: e.target.value })} /></label>
                  <label><span className="label">Symbol</span><input className="field mono" value={t.symbol} placeholder="FORGE" onChange={(e) => setT({ ...t, symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })} /></label>
                  <label><span className="label">Trading tax <span className="hint">bps, at most 1000</span></span><div className="ig"><input className="field mono" value={t.taxBps} onChange={(e) => setT({ ...t, taxBps: Number(e.target.value.replace(/[^0-9]/g, "")) })} /><span className="unit">bps</span></div></label>
                  <label><span className="label">Pool seed</span><div className="ig"><input className="field mono" value={t.poolBnb} onChange={(e) => setT({ ...t, poolBnb: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} /><span className="unit">BNB</span></div></label>
                </div>
                <button className="btn btn-primary btn-lg btn-block" disabled={busy || !data || !t.name || !t.symbol || t.taxBps > 1000 || !(t.poolBnb > 0)} onClick={() => void launch()}>{busy ? <><ThinkingMark size={16} />Launching…</> : <><Icon name="rocket" size={16} />Launch with Covenant Lite</>}</button>
              </>
            )}
            {msg ? <div className={msg.tone === "good" ? "mint-ok" : "mint-err"} role={msg.tone === "good" ? "status" : "alert"}><Icon name={msg.tone === "good" ? "check" : "alert"} size={16} /><span className="anywhere">{msg.text}</span></div> : null}
          </div>
        </div>
        )}
      </div>

      <aside className="stack sticky" aria-label="Prepared for Four.meme">
        <div className="card">
          <div className="card-head ruled"><div><h2 className="h-card">Prepared for Four.meme</h2><p className="t-xs muted w5">{template ? "Paste these on Four.meme's create page" : src.mode === "live" ? "This deployment names no Lite template" : LOCAL_MODE ? "Connect to the local chain to read the template" : "Reading the template address…"}</p></div>{data ? <span className="badge good"><Icon name="check" size={13} />Ready</span> : null}</div>
          <div className="card-body ruled stack">
            <LRow k="Tax vault template">{template ? <CopyCode text={template} /> : <span className="t-s muted w5">–</span>}</LRow>
            <LRow k="Vault data">{data ? <CopyCode text={data} wrap /> : <span className="t-s muted w5">{problems.length ? "Fix the terms first" : "–"}</span>}</LRow>
            <p className="t-xs muted w5">The tuple (template, initData) the live ForwardVault decodes. The flat encoding in Four.meme&apos;s docs reverts on it.</p>
            <ol className="lite-steps">
              <li>Open Four.meme&apos;s create page and choose a <b>tax token</b>.</li>
              <li>For the founder&apos;s tax recipient, pick the <b>tax vault template</b> above.</li>
              <li>Paste the <b>vault data</b>.</li>
              <li>Create the token. ForwardVault clones Covenant Lite as your recipient, so your share of trading tax lands in the vault, not your wallet.</li>
              <li>Claim within each heartbeat window to stay present; winding down early opens redemption to holders.</li>
            </ol>
            <Note icon="info">ForwardVault keeps a 6% royalty for the template author. Tokens still unsold on Four.meme&apos;s inner market count toward the redeemable supply until migration, which lowers the per-token payout.</Note>
          </div>
        </div>
      </aside>
    </div>
  );
}

function LField({ label, hint, value, children }: { label: string; hint: string; value: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
      <span className="label" style={{ margin: 0 }}>{label} <span className="hint">{hint}</span></span>
      <span className="fig num" style={{ fontSize: 20 }}>{value}</span>
      {children}
    </div>
  );
}

function LRow({ k, children }: { k: string; children: ReactNode }) {
  return <div style={{ display: "grid", gap: 4, minWidth: 0 }}><span className="lbl">{k}</span>{children}</div>;
}

function LNum({ value, onChange, unit }: { value: number; onChange: (n: number) => void; unit: string }) {
  const [s, setS] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); if (Number(s) !== value) setS(String(value)); }
  return <div className="ig"><input className="field mono" inputMode="decimal" value={s} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setS(v); onChange(Number(v) || 0); }} /><span className="unit">{unit}</span></div>;
}

