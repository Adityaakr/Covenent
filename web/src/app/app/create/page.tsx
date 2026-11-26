"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { Icon, type IconName } from "@/components/app/icons";
import { BnbUnit, Meter, Note, Segmented, TokenAvatar, cx } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { agentOwner, checkTerms, createCovenantLive, createTargets, registerAgent, type FactoryKind } from "@/lib/chain/create";
import { addressOf } from "@/lib/chain/deployment";
import type { MineMessage } from "@/lib/chain/salt";
import { BOUNDS, DEFAULT_TERMS, DEMO_TIMERS, FLAP } from "@/lib/covenant/defaults";
import { floorAfterMonths, runwayMonths, settleRaise, split, startingFloorRatio, tapPer30d } from "@/lib/covenant/math";
import { DAY, span } from "@/lib/covenant/time";
import type { Address, Terms } from "@/lib/covenant/types";
import { useSource } from "@/lib/data/hooks";
import { bnb, bps, multiple, pct, price, tokens, usd } from "@/lib/format";

type Mine = { state: "idle" | "mining" | "found"; tries: number; rate: number; salt?: `0x${string}`; address?: Address; ms?: number };

const STEPS: { title: string; sub: string; icon: IconName }[] = [
  { title: "Token and issuer", sub: "Who raises and what buyers receive.", icon: "user" },
  { title: "Raise", sub: "Commitments are uncapped. Above the cap, everyone is scaled back pro rata.", icon: "coins" },
  { title: "Supply split", sub: "More pool means deeper liquidity and a lower starting floor.", icon: "pie" },
  { title: "The rules", sub: "Defaults from the design document. The launcher factory enforces the bounds.", icon: "shield" },
  { title: "Review and launch", sub: "Mine the token address, check the terms and create the covenant.", icon: "rocket" },
];

export default function CreatePage() {
  const router = useRouter();
  const src = useSource();
  const wallet = useWallet();
  const config = useConfig();
  const qc = useQueryClient();
  const [t, setT] = useState<Terms>({ ...DEFAULT_TERMS, name: "", symbol: "", meta: "", teamWallet: (wallet.address as Address) ?? DEFAULT_TERMS.teamWallet });
  const [issuerKind, setIssuerKind] = useState<"agent" | "human">("agent");
  const [agentId, setAgentId] = useState("4127");
  // Live only: the short-timer demo factory (time in minutes) or the production factory (time in days)
  const [factory, setFactory] = useState<FactoryKind>("demo");
  const demo = src.mode === "live" && factory === "demo";
  const UNIT = demo ? 60 : DAY;
  const unit = demo ? "minutes" : "days";
  const [agentNote, setAgentNote] = useState<string | null>(null);
  const timers = (k: FactoryKind) => (k === "demo"
    ? { saleDuration: DEMO_TIMERS.saleDuration, unlockWindow: DEMO_TIMERS.unlockWindow, cliff: 0, exitStreak: DEMO_TIMERS.exitStreak, roundLength: DEMO_TIMERS.roundLength, cooldown: DEMO_TIMERS.cooldown, heartbeat: DEMO_TIMERS.heartbeat }
    : { saleDuration: DEFAULT_TERMS.saleDuration, unlockWindow: DEFAULT_TERMS.unlockWindow, cliff: DEFAULT_TERMS.cliff, exitStreak: DEFAULT_TERMS.exitStreak, roundLength: DEFAULT_TERMS.roundLength, cooldown: DEFAULT_TERMS.cooldown, heartbeat: DEFAULT_TERMS.heartbeat });
  function pickFactory(k: FactoryKind) {
    setFactory(k);
    setT((x) => ({ ...x, ...timers(k) }));
  }
  // Adjust state while rendering (no effect): demo timers once the live deployment is found, and the connected
  // wallet as the team wallet unless the visitor typed one.
  const [seenMode, setSeenMode] = useState(src.mode);
  if (seenMode !== src.mode) {
    setSeenMode(src.mode);
    if (src.mode === "live") setT((x) => ({ ...x, ...timers(factory) }));
  }
  const [seenWallet, setSeenWallet] = useState<string | undefined>(undefined);
  if (wallet.address && seenWallet !== wallet.address) {
    setSeenWallet(wallet.address);
    if (t.teamWallet === DEFAULT_TERMS.teamWallet) setT((x) => ({ ...x, teamWallet: wallet.address as Address }));
  }
  const [mine, setMine] = useState<Mine>({ state: "idle", tries: 0, rate: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState<number[]>([]);
  const set = <K extends keyof Terms>(k: K, val: Terms[K]) => setT((x) => ({ ...x, [k]: val }));

  const teamBps = 10_000 - t.saleBps - t.poolBps;
  const tranchesSum = t.trancheBps.reduce((a, b) => a + b, 0);
  const sp = split(t.totalSupply, t.saleBps, t.poolBps);
  const atMin = settleRaise(t.minRaise, t.minRaise, t.cap, sp);
  const atCap = settleRaise(t.cap, t.minRaise, t.cap, sp);
  const ratio = startingFloorRatio(t.saleBps, t.poolBps);
  const budget = tapPer30d(t.tapUsdPer30d, 600, atCap.T0, t.tapCapBps);

  /** Each problem with the step that fixes it. */
  const issues = useMemo(() => {
    const p: [number, string][] = [];
    if (!t.name.trim()) p.push([0, "Name the token"]);
    if (!/^[A-Z0-9]{2,10}$/.test(t.symbol)) p.push([0, "Symbol: 2 to 10 capital letters or digits"]);
    if (t.saleBps < BOUNDS.saleBpsMin) p.push([2, "Sale share must be at least 40%"]);
    if (t.poolBps < BOUNDS.poolBpsMin || t.poolBps > t.saleBps) p.push([2, "Pool share must be 5% to the sale share"]);
    if (teamBps > BOUNDS.teamBpsMax || teamBps < 0) p.push([2, "Team share must be at most 30%"]);
    if (tranchesSum !== teamBps) p.push([2, `Tranches add to ${bps(tranchesSum)}; the team share is ${bps(teamBps)}`]);
    if (t.tapCapBps > BOUNDS.tapCapBpsMax) p.push([3, "Tap cap must be at most 10% a month"]);
    // the demo factory's minute-scale bounds are checked by the factory itself (checkTerms) before sending
    if (!demo && (t.exitStreak < BOUNDS.exitStreakMin || t.exitStreak > BOUNDS.exitStreakMax)) p.push([3, "Exit streak must be 1 to 14 days"]);
    if (!demo && t.roundLength < BOUNDS.roundLengthMin) p.push([3, "Exit round must be at least 3 days"]);
    if (t.exitFeeBps > BOUNDS.exitFeeBpsMax) p.push([3, "Exit fee must be at most 3%"]);
    if (!demo && (t.heartbeat < BOUNDS.heartbeatMin || t.heartbeat > BOUNDS.heartbeatMax)) p.push([3, "Heartbeat must be 14 to 90 days"]);
    if (!(t.minRaise > 0) || t.cap < t.minRaise) p.push([1, "The cap must be at least the minimum"]);
    if ((t.minRaise * t.poolBps) / t.saleBps < 1) p.push([1, "Pool seed at the minimum is under Flap's creation floor (about 1 BNB here)"]);
    if (!/^0x[0-9a-fA-F]{40}$/.test(t.teamWallet)) p.push([0, "Team wallet must be an address"]);
    if (issuerKind === "agent" && !(Number(agentId) > 0)) p.push([0, "Agent id must be a registered ERC-8004 id"]);
    return p;
  }, [t, teamBps, tranchesSum, issuerKind, agentId, demo]);
  const problems = issues.map(([, m]) => m);
  const stepIssues = (k: number) => issues.filter(([s]) => s === k).map(([, m]) => m);

  useEffect(() => () => worker.current?.terminate(), []);

  function startMining() {
    worker.current?.terminate();
    const w = new Worker(new URL("../../../lib/chain/salt.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    setMine({ state: "mining", tries: 0, rate: 0 });
    w.onmessage = (e: MessageEvent<MineMessage>) => {
      if (e.data.type === "progress") setMine((m) => ({ ...m, tries: e.data.type === "progress" ? e.data.tries : m.tries, rate: e.data.type === "progress" ? e.data.rate : m.rate }));
      else { setMine({ state: "found", tries: e.data.tries, rate: e.data.tries / (e.data.ms / 1000), salt: e.data.salt, address: e.data.address, ms: e.data.ms }); w.terminate(); }
    };
    const portal = (src.payload?.deployment && addressOf(src.payload.deployment, "portal", "flapPortal", "mockPortal")) || FLAP.portal;
    const impl = (src.payload?.deployment && addressOf(src.payload.deployment, "taxTokenImpl", "taxTokenImplementation", "tokenImpl")) || FLAP.taxTokenImpl;
    w.postMessage({ deployer: portal, implementation: impl, seed: String(BigInt(Date.now()) * 1_000_003n), suffix: "7777" });
  }

  async function create() {
    setErr(null);
    const terms: Terms = { ...t, agentId: issuerKind === "agent" ? Number(agentId) : 0 };
    if (src.mode !== "live") { setErr(`No chain to create on: ${src.reason}. Start the stack with scripts/dev-all.sh.`); return; }
    // Live: Portal.newLauncher(factory, abi.encode(Terms)), Terms encoded from the factory's own checkTerms input.
    const d = src.payload!.deployment!;
    const tg = createTargets(src.payload, factory);
    if (!tg.portal || !tg.factory || !tg.termsParam) { setErr("The deployment names no Flap Portal and covenant launcher factory."); return; }
    if (!wallet.address) { wallet.connect(); return; }
    if (!mine.salt) { setErr("Mine a 7777 salt first."); return; }
    setBusy(true);
    try {
      if (terms.agentId > 0 && tg.identityRegistry) {
        const owner = await agentOwner(src.client!, tg.identityRegistry, BigInt(terms.agentId));
        if (!owner) throw new Error(`Agent #${terms.agentId} is not registered on this chain. Register one below.`);
        if (owner.toLowerCase() !== terms.teamWallet.toLowerCase()) throw new Error(`Agent #${terms.agentId} belongs to ${owner}, not the team wallet.`);
      }
      const why = await checkTerms(src.client!, tg, terms, mine.salt);
      if (why) throw new Error(`The factory refuses these terms: ${why}`);
      const { launcher } = await createCovenantLive(config, src.client!, d.chainId, tg, terms, mine.salt);
      await qc.invalidateQueries({ queryKey: ["source"] }); // rediscover launchers so the new one opens at once
      router.push(launcher ? `/app/c/${launcher}/raise` : "/app");
    } catch (e) {
      setErr((e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setErr(null);
    const tg = createTargets(src.payload, factory);
    if (!wallet.address) { wallet.connect(); return; }
    if (!tg.identityRegistry || !src.payload?.deployment) { setErr("The deployment names no ERC-8004 identity registry."); return; }
    setBusy(true);
    try {
      const id = await registerAgent(config, src.payload.deployment.chainId, tg.identityRegistry, wallet.address, `covenant://agent/${(t.symbol || "issuer").toLowerCase()}`);
      setAgentId(id.toString());
      set("teamWallet", wallet.address as Address);
      setAgentNote(`Registered agent #${id} to ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}, now the team wallet.`);
    } catch (e) {
      setErr((e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const here = stepIssues(step);
  const last = step === STEPS.length - 1;

  return (
    <main className="page">
      <div className="sec-head">
        <div className="stack-sm" style={{ display: "grid" }}>
          <span className="eyebrow">Create a covenant</span>
          <h1 className="h-page">Write the covenant. <span className="soft">Nothing can be edited later except lowering the tap.</span></h1>
        </div>
        <span className={cx("srcpill", src.mode === "live" ? "live" : "mock")} style={{ height: 30 }} title={src.reason}><span className="dot" />{src.mode === "live" ? "Creates on the local chain" : src.mode === "checking" ? "Checking the local chain" : "Offline: connect to create"}</span>
      </div>

      <nav className="steps" aria-label="Steps">
        {STEPS.map((s, k) => (
          <button key={s.title} type="button" className="step" data-state={k < step ? "done" : k === step ? "current" : "todo"} data-bad={k !== step && k < step && stepIssues(k).length > 0} aria-current={k === step ? "step" : undefined} onClick={() => setStep(k)}>
            <span className="bar"><i /></span>
            <span className="t"><span className="n">{k < step && stepIssues(k).length === 0 ? <Icon name="check" size={11} strokeWidth={2.4} /> : k + 1}</span>{s.title}</span>
          </button>
        ))}
      </nav>

      <div className="grid-side">
        <div className="card">
          <div className="card-head ruled">
            <div className="row" style={{ gap: 12 }}><span className="icon-tile accent"><Icon name={STEPS[step]!.icon} size={17} /></span><div><h2 className="h-card">{STEPS[step]!.title}</h2><p className="t-xs muted w5">{STEPS[step]!.sub}</p></div></div>
            <span className="t-xs muted w5 num">Step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="card-body ruled form-step rise" key={step}>
            {step === 0 ? (
              <>
                <div className="grid2">
                  <Field label="Name"><input className="field" value={t.name} placeholder="Lumen" onChange={(e) => set("name", e.target.value)} /></Field>
                  <Field label="Symbol" hint="2 to 10 letters or digits"><input className="field mono" value={t.symbol} placeholder="LUMEN" onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} /></Field>
                </div>
                <Field label="What it does" hint="shown on the covenant page"><input className="field" value={t.meta} placeholder="An AI research agent that sells market briefs to other agents" onChange={(e) => set("meta", e.target.value)} /></Field>
                <div>
                  <span className="label">Issuer</span>
                  <div className="choice" role="group" aria-label="Issuer">
                    <button type="button" aria-pressed={issuerKind === "agent"} onClick={() => setIssuerKind("agent")}><span className="icon-tile agent"><Icon name="agent" size={17} /></span><span><b className="t-s ink" style={{ display: "block" }}>AI agent</b><span className="t-xs muted w5">With an ERC-8004 identity and a track record</span></span><span className="radio" /></button>
                    <button type="button" aria-pressed={issuerKind === "human"} onClick={() => setIssuerKind("human")}><span className="icon-tile"><Icon name="team" size={17} /></span><span><b className="t-s ink" style={{ display: "block" }}>Human team</b><span className="t-xs muted w5">Bound through the team wallet</span></span><span className="radio" /></button>
                  </div>
                </div>
                <div className="grid2">
                  <Field label="Team wallet" hint="receives the tap, fixed forever"><input className="field mono" value={t.teamWallet} onChange={(e) => set("teamWallet", e.target.value.trim() as Address)} /></Field>
                  {issuerKind === "agent" ? <Field label="Agent id" hint="owned by the team wallet"><input className="field mono" value={agentId} inputMode="numeric" onChange={(e) => setAgentId(e.target.value.replace(/[^0-9]/g, ""))} /></Field> : <div />}
                </div>
                {src.mode === "live" && issuerKind === "agent" ? (
                  <div className="tile row between wrap-ok" style={{ gap: 12 }}>
                    <span className="t-s muted w5" style={{ flex: "1 1 260px" }}>{agentNote ?? "No agent identity yet? Register one from the connected wallet in the ERC-8004 identity registry."}</span>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void register()}><Icon name="agent" size={14} />Register agent identity</button>
                  </div>
                ) : null}
                {src.mode === "live" ? (
                  <div>
                    <span className="label">Launcher factory <span className="hint">same five rules, different clocks</span></span>
                    <Segmented label="Launcher factory" value={factory} onChange={pickFactory} options={[{ value: "demo", label: "Demo timers (minutes)" }, { value: "production", label: "Production (days)" }]} />
                  </div>
                ) : null}
              </>
            ) : step === 1 ? (
              <>
                <div className="grid3">
                  <Field label="Minimum" hint="BNB"><Num value={t.minRaise} onChange={(n) => set("minRaise", n)} unit="BNB" /></Field>
                  <Field label="Cap" hint="BNB"><Num value={t.cap} onChange={(n) => set("cap", n)} unit="BNB" /></Field>
                  <Field label="Sale window" hint={unit}><Num value={t.saleDuration / UNIT} onChange={(n) => set("saleDuration", n * UNIT)} unit={unit} /></Field>
                </div>
                <div className="review">
                  <div><span className="t-xs muted w5">At the minimum</span><span className="num ink">{bnb(atMin.T0)} BNB to the vault</span><span className="t-xs muted w5 num">pool seed {bnb(atMin.qPool)} BNB</span></div>
                  <div><span className="t-xs muted w5">At the cap</span><span className="num ink">{bnb(atCap.T0)} BNB to the vault</span><span className="t-xs muted w5 num">pool seed {bnb(atCap.qPool)} BNB</span></div>
                </div>
                <Note tone="accent">Below the minimum, everyone is refunded in full. A launch that reverts also refunds in full.</Note>
              </>
            ) : step === 2 ? (
              <>
                <div className="split-bar" aria-label="Supply split">
                  <div style={{ flexGrow: t.saleBps, flexBasis: 0, background: "var(--accent-strong)" }}>Sale {bps(t.saleBps)}</div>
                  <div style={{ flexGrow: t.poolBps, flexBasis: 0, background: "var(--good)" }}>{t.poolBps >= 1000 ? `Pool ${bps(t.poolBps)}` : ""}</div>
                  <div style={{ flexGrow: Math.max(0, teamBps), flexBasis: 0, background: "var(--agent)" }}>{teamBps >= 1000 ? `Team ${bps(teamBps)}` : ""}</div>
                </div>
                <Slider label="Sale" value={t.saleBps} min={4000} max={9000} step={500} onChange={(n) => set("saleBps", n)} />
                <Slider label="Pool" value={t.poolBps} min={500} max={Math.min(t.saleBps, 3000)} step={250} onChange={(n) => set("poolBps", n)} />
                <div className="row between t-s w5"><span className="muted">Team, locked until the price holds each multiple</span><span className="num ink">{bps(teamBps)}</span></div>
                <div className="grid3">
                  {t.trancheBps.map((b, k) => (
                    <Field key={k} label={`Tranche ${k + 1}`} hint={`at ${multiple(t.trancheMultiple[k] ?? 0)}`}>
                      <div className="ig"><input className="field mono" inputMode="decimal" value={b / 100} onChange={(e) => { const n = Math.round((Number(e.target.value) || 0) * 100); setT((x) => ({ ...x, trancheBps: x.trancheBps.map((y, i) => (i === k ? n : y)) })); }} /><span className="unit">%</span></div>
                    </Field>
                  ))}
                </div>
              </>
            ) : step === 3 ? (
              <>
                <div className="grid2">
                  <Field label="Tap budget" hint="USD per 30 days"><Num value={t.tapUsdPer30d} onChange={(n) => set("tapUsdPer30d", n)} unit="USD" /></Field>
                  <Field label="Tap cap" hint="% of treasury per 30 days, max 10"><Num value={t.tapCapBps / 100} onChange={(n) => set("tapCapBps", Math.round(n * 100))} unit="%" /></Field>
                  <Field label="Exit streak" hint={demo ? "minutes under book" : "days under book, 1 to 14"}><Num value={t.exitStreak / UNIT} onChange={(n) => set("exitStreak", n * UNIT)} unit={unit} /></Field>
                  <Field label="Exit round" hint={demo ? "minutes" : "days, at least 3"}><Num value={t.roundLength / UNIT} onChange={(n) => set("roundLength", n * UNIT)} unit={unit} /></Field>
                  <Field label="Exit fee" hint="%, max 3, zero at wind-down"><Num value={t.exitFeeBps / 100} onChange={(n) => set("exitFeeBps", Math.round(n * 100))} unit="%" /></Field>
                  <Field label="Heartbeat" hint={demo ? "minutes" : "days, 14 to 90"}><Num value={t.heartbeat / UNIT} onChange={(n) => set("heartbeat", n * UNIT)} unit={unit} /></Field>
                </div>
                <Note tone="good"><b>Exit rule, as fixed after review.</b> The streak decays instead of resetting (an hour above book takes an hour off), compares on-chain numbers only, and never waits on pool depth or Atlas. Depth and Atlas guard team unlocks.</Note>
              </>
            ) : (
              <>
                <div className="row" style={{ gap: 14 }}>
                  <TokenAvatar seed={mine.address ?? (t.symbol || "new covenant")} size={52} issuer={issuerKind} />
                  <div style={{ minWidth: 0 }}><div className="h-card">{t.name || "Unnamed token"} <span className="mono t-xs muted">${t.symbol || "SYMBOL"}</span></div><p className="t-xs muted w5 trunc">{t.meta || "No description yet."}</p></div>
                </div>
                <div className="review">
                  {([
                    ["Issuer", issuerKind === "agent" ? `AI agent #${agentId || "?"}` : "Human team"],
                    ["Raise", `${bnb(t.minRaise, 0)} to ${bnb(t.cap, 0)} BNB, ${span(t.saleDuration)}`],
                    ["Split", `${bps(t.saleBps)} sale · ${bps(t.poolBps)} pool · ${bps(teamBps)} team`],
                    ["Tranches", t.trancheBps.map((b, k) => `${bps(b)} at ${multiple(t.trancheMultiple[k] ?? 0)}`).join(", ")],
                    ["Tap", `${usd(t.tapUsdPer30d)} / 30d, cap ${bps(t.tapCapBps)}`],
                    ["Exit", `${span(t.exitStreak)} streak, ${span(t.roundLength)} round, ${bps(t.exitFeeBps)} fee`],
                    ["Heartbeat", span(t.heartbeat)],
                    ["Factory", src.mode === "live" ? (demo ? "Demo timers (minutes)" : "Production (days)") : "–"],
                    ["Team wallet", `${t.teamWallet.slice(0, 8)}…${t.teamWallet.slice(-6)}`],
                  ] as [string, string][]).map(([k, val]) => <div key={k}><span className="t-xs muted w5">{k}</span><span className="t-s ink w5 num">{val}</span></div>)}
                </div>
                <div className="tile stack-sm" style={{ display: "grid" }}>
                  <div className="row between"><span className="lbl">Token address</span><span className="t-xs muted w5">Flap needs it to end in 7777</span></div>
                  {mine.state === "found" ? (
                    <>
                      <div className="mono t-s anywhere">{mine.address!.slice(0, -4)}<b style={{ color: "var(--accent)" }}>{mine.address!.slice(-4)}</b></div>
                      <p className="t-xs muted w5">Found after {mine.tries.toLocaleString("en-US")} tries in {(mine.ms! / 1000).toFixed(1)} s. Salt <span className="mono">{mine.salt!.slice(0, 12)}…</span></p>
                    </>
                  ) : mine.state === "mining" ? (
                    <>
                      <Meter value={mine.tries} max={Math.max(65_536, mine.tries * 1.2)} label="Salt mining progress" />
                      <p className="t-xs muted w5 num">{mine.tries.toLocaleString("en-US")} tries · {Math.round(mine.rate).toLocaleString("en-US")}/s · about 65,536 on average</p>
                    </>
                  ) : <p className="t-xs muted w5">The app predicts the token&apos;s clone address from the Portal and the tax token implementation, in a background worker.</p>}
                  <button className="btn btn-secondary" onClick={startMining} disabled={mine.state === "mining"}><Icon name="sparkle" size={15} />{mine.state === "found" ? "Mine again" : mine.state === "mining" ? "Mining…" : "Mine a 7777 salt"}</button>
                </div>
                {problems.length ? <Problems list={problems} /> : null}
                {src.mode !== "live" ? <Note tone="warn" icon="alert"><b>Not connected to the local chain.</b> {src.reason}. Start the stack with <span className="mono">scripts/dev-all.sh</span>; creating sends the transaction there.</Note> : null}
                {err ? <Note tone="warn">{err}</Note> : null}
              </>
            )}
            {!last && here.length && tried.includes(step) ? <Problems list={here} /> : null}
          </div>
          <div className="card-foot">
            <button className="btn btn-ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><Icon name="back" size={15} />Back</button>
            {last ? (
              <button className="btn btn-primary btn-lg" disabled={problems.length > 0 || mine.state !== "found" || busy || src.mode !== "live"} onClick={() => void create()}>
                {busy ? <><span className="spin" />Creating…</> : mine.state !== "found" ? "Mine a salt to create" : <><Icon name="rocket" size={15} />Create covenant</>}
              </button>
            ) : <button className="btn btn-primary" onClick={() => { if (here.length && !tried.includes(step)) setTried([...tried, step]); else setStep(step + 1); }}>{here.length && tried.includes(step) ? "Continue anyway" : "Continue"}<Icon name="arrow" size={15} /></button>}
          </div>
        </div>

        <aside className="stack sticky" aria-label="Live preview">
          <div className="card preview">
            <div className="card-head"><div><h3 className="h-card">Live preview</h3><p className="t-xs muted w5">BNB/USD assumed at $600</p></div><span className="badge accent"><span className="dot pulse" />Live</span></div>
            <div className="card-body stack">
              <div style={{ display: "grid", gap: 2 }}><span className="lbl">Sale price at the cap</span><span className="fig-md mono" style={{ fontFamily: "var(--font-mono-stack)", fontSize: 20 }}>{price(atCap.salePrice)}<BnbUnit /></span></div>
              <dl className="kv">
                <dt>Pool seed at the cap</dt><dd className="num">{bnb(atCap.qPool)} BNB + {tokens(sp.P)}</dd>
                <dt>Treasury at the cap</dt><dd className="num">{bnb(atCap.T0)} BNB</dd>
                <dt>Treasury at the minimum</dt><dd className="num">{bnb(atMin.T0)} BNB</dd>
                <dt>Starting floor</dt><dd className="num">{pct(ratio, 1)} of sale price</dd>
                <dt>Tap at the cap</dt><dd className="num">{bnb(budget.bnb)} BNB / 30d</dd>
              </dl>
              <div className="stack-sm" style={{ display: "grid" }}>
                <span className="lbl">Floor as a share of the sale price</span>
                {[0, 6, 12, 24].map((m) => (
                  <div key={m} className="floor-row">
                    <span className="muted">{m === 0 ? "Launch" : `${m} months`}</span>
                    <Meter size="sm" value={floorAfterMonths(m, t.tapCapBps, ratio)} max={1} />
                    <span className="num ink" style={{ textAlign: "right" }}>{pct(floorAfterMonths(m, t.tapCapBps, ratio), 0)}</span>
                  </div>
                ))}
                <p className="t-xs muted w5">Cap binding, no tax. Runway to a quarter of the treasury: <span className="num">{runwayMonths(t.tapCapBps).toFixed(0)}</span> months.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Problems({ list }: { list: string[] }) {
  return <ul className="problems" aria-label="To fix">{list.map((p) => <li key={p}><Icon name="alert" size={13} />{p}</li>)}</ul>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label style={{ display: "block", minWidth: 0 }}><span className="label">{label}{hint ? <span className="hint">{hint}</span> : null}</span>{children}</label>;
}

function Num({ value, onChange, unit }: { value: number; onChange: (n: number) => void; unit?: string }) {
  const [s, setS] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); if (Number(s) !== value) setS(String(value)); }
  const input = <input className="field mono" inputMode="decimal" value={s} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setS(v); onChange(Number(v) || 0); }} />;
  return unit ? <div className="ig">{input}<span className="unit">{unit}</span></div> : input;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  const fill = `${((value - min) / Math.max(1, max - min)) * 100}%`;
  return (
    <div>
      <div className="row between t-s w5"><span className="ink">{label}</span><span className="num ink">{bps(value)}</span></div>
      <input className="range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} style={{ ["--fill" as string]: fill }} />
    </div>
  );
}
