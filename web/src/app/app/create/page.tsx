"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { Icon } from "@/components/app/icons";
import { Meter, Note, Segmented } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { agentOwner, checkTerms, createCovenantLive, createTargets, registerAgent, type FactoryKind } from "@/lib/chain/create";
import { addressOf } from "@/lib/chain/deployment";
import type { MineMessage } from "@/lib/chain/salt";
import { BOUNDS, DEFAULT_TERMS, DEMO_TIMERS, ERC8004, FLAP } from "@/lib/covenant/defaults";
import { floorAfterMonths, runwayMonths, settleRaise, split, startingFloorRatio, tapPer30d } from "@/lib/covenant/math";
import { DAY } from "@/lib/covenant/time";
import type { Address, Terms } from "@/lib/covenant/types";
import { useSource } from "@/lib/data/hooks";
import { mockCreate } from "@/lib/data/mock-store";
import { bnb, bps, pct, price, tokens, usd } from "@/lib/format";

type Mine = { state: "idle" | "mining" | "found"; tries: number; rate: number; salt?: `0x${string}`; address?: Address; ms?: number };

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
  const set = <K extends keyof Terms>(k: K, val: Terms[K]) => setT((x) => ({ ...x, [k]: val }));

  const teamBps = 10_000 - t.saleBps - t.poolBps;
  const tranchesSum = t.trancheBps.reduce((a, b) => a + b, 0);
  const sp = split(t.totalSupply, t.saleBps, t.poolBps);
  const atMin = settleRaise(t.minRaise, t.minRaise, t.cap, sp);
  const atCap = settleRaise(t.cap, t.minRaise, t.cap, sp);
  const ratio = startingFloorRatio(t.saleBps, t.poolBps);
  const budget = tapPer30d(t.tapUsdPer30d, 600, atCap.T0, t.tapCapBps);

  const problems = useMemo(() => {
    const p: string[] = [];
    if (!t.name.trim()) p.push("Name the token");
    if (!/^[A-Z0-9]{2,10}$/.test(t.symbol)) p.push("Symbol: 2 to 10 capital letters or digits");
    if (t.saleBps < BOUNDS.saleBpsMin) p.push("Sale share must be at least 40%");
    if (t.poolBps < BOUNDS.poolBpsMin || t.poolBps > t.saleBps) p.push("Pool share must be 5% to the sale share");
    if (teamBps > BOUNDS.teamBpsMax || teamBps < 0) p.push("Team share must be at most 30%");
    if (tranchesSum !== teamBps) p.push(`Tranches add to ${bps(tranchesSum)}; the team share is ${bps(teamBps)}`);
    if (t.tapCapBps > BOUNDS.tapCapBpsMax) p.push("Tap cap must be at most 10% a month");
    // the demo factory's minute-scale bounds are checked by the factory itself (checkTerms) before sending
    if (!demo && (t.exitStreak < BOUNDS.exitStreakMin || t.exitStreak > BOUNDS.exitStreakMax)) p.push("Exit streak must be 1 to 14 days");
    if (!demo && t.roundLength < BOUNDS.roundLengthMin) p.push("Exit round must be at least 3 days");
    if (t.exitFeeBps > BOUNDS.exitFeeBpsMax) p.push("Exit fee must be at most 3%");
    if (!demo && (t.heartbeat < BOUNDS.heartbeatMin || t.heartbeat > BOUNDS.heartbeatMax)) p.push("Heartbeat must be 14 to 90 days");
    if (!(t.minRaise > 0) || t.cap < t.minRaise) p.push("The cap must be at least the minimum");
    if ((t.minRaise * t.poolBps) / t.saleBps < 1) p.push("Pool seed at the minimum is under Flap's creation floor (about 1 BNB here)");
    if (!/^0x[0-9a-fA-F]{40}$/.test(t.teamWallet)) p.push("Team wallet must be an address");
    if (issuerKind === "agent" && !(Number(agentId) > 0)) p.push("Agent id must be a registered ERC-8004 id");
    return p;
  }, [t, teamBps, tranchesSum, issuerKind, agentId, demo]);

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
    if (src.mode !== "live") {
      const id = mockCreate(terms, issuerKind === "agent"
        ? { kind: "agent", teamWallet: t.teamWallet, agentId: Number(agentId), name: `Agent #${agentId}`, registry: ERC8004[97].identity as Address, outcomes: [] }
        : { kind: "human", teamWallet: t.teamWallet, outcomes: [] }, mine.address);
      router.push(`/app/c/${id}/raise`);
      return;
    }
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

  return (
    <main className="page">
      <div style={{ display: "grid", gap: 8 }}>
        <p className="eyebrow">Create</p>
        <h1 className="d1">Write the covenant. <span className="soft">Nothing can be edited later except lowering the tap.</span></h1>
      </div>
      <div className="grid-main">
        <div className="stack">
          <Section title="Token and issuer" sub="Who raises and what buyers receive.">
            <div className="grid2">
              <Field label="Name"><input className="field" value={t.name} placeholder="Lumen" onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Symbol"><input className="field mono" value={t.symbol} placeholder="LUMEN" onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} /></Field>
            </div>
            <Field label="What it does" hint="shown on the covenant sheet"><input className="field" value={t.meta} placeholder="An AI research agent that sells market briefs to other agents" onChange={(e) => set("meta", e.target.value)} /></Field>
            <Field label="Issuer">
              <Segmented label="Issuer" value={issuerKind} onChange={setIssuerKind} options={[{ value: "agent", label: "AI agent (ERC-8004)" }, { value: "human", label: "Human team" }]} />
            </Field>
            <div className="grid2">
              <Field label="Team wallet" hint="receives the tap, fixed forever"><input className="field mono" value={t.teamWallet} onChange={(e) => set("teamWallet", e.target.value.trim() as Address)} /></Field>
              {issuerKind === "agent" ? <Field label="Agent id" hint="owned by the team wallet"><input className="field mono" value={agentId} inputMode="numeric" onChange={(e) => setAgentId(e.target.value.replace(/[^0-9]/g, ""))} /></Field> : <div />}
            </div>
            {src.mode === "live" && issuerKind === "agent" ? (
              <div className="row between small" style={{ gap: 12, flexWrap: "wrap" }}>
                <span className="muted">{agentNote ?? "No agent identity yet? Register one from the connected wallet (ERC-8004 identity registry)."}</span>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void register()}>Register agent identity</button>
              </div>
            ) : null}
            {src.mode === "live" ? (
              <Field label="Launcher factory" hint="same five rules, different clocks">
                <Segmented label="Launcher factory" value={factory} onChange={pickFactory} options={[{ value: "demo", label: "Demo timers (minutes)" }, { value: "production", label: "Production (days)" }]} />
              </Field>
            ) : null}
          </Section>

          <Section title="Raise" sub="Commitments are uncapped. Above the cap, everyone is scaled back pro rata.">
            <div className="grid3">
              <Field label="Minimum" hint="BNB"><Num value={t.minRaise} onChange={(n) => set("minRaise", n)} /></Field>
              <Field label="Cap" hint="BNB"><Num value={t.cap} onChange={(n) => set("cap", n)} /></Field>
              <Field label="Sale window" hint={unit}><Num value={t.saleDuration / UNIT} onChange={(n) => set("saleDuration", n * UNIT)} /></Field>
            </div>
          </Section>

          <Section title="Supply split" sub="More pool means deeper liquidity and a lower starting floor.">
            <Slider label="Sale" value={t.saleBps} min={4000} max={9000} step={500} onChange={(n) => set("saleBps", n)} />
            <Slider label="Pool" value={t.poolBps} min={500} max={Math.min(t.saleBps, 3000)} step={250} onChange={(n) => set("poolBps", n)} />
            <div className="row between small"><span className="muted">Team (locked, unlocks on price)</span><span className="mono ink">{bps(teamBps)}</span></div>
            <div className="grid3">
              {t.trancheBps.map((b, k) => (
                <Field key={k} label={`Tranche ${k + 1}`} hint={`at ${t.trancheMultiple[k]! / 100}x`}>
                  <div className="input-group"><input className="field mono" inputMode="decimal" value={b / 100} onChange={(e) => { const n = Math.round((Number(e.target.value) || 0) * 100); setT((x) => ({ ...x, trancheBps: x.trancheBps.map((y, i) => (i === k ? n : y)) })); }} /><span className="unit">%</span></div>
                </Field>
              ))}
            </div>
          </Section>

          <Section title="The rules" sub="Defaults from the design document. Bounds are enforced by the launcher factory.">
            <div className="grid2">
              <Field label="Tap budget" hint="USD per 30 days"><Num value={t.tapUsdPer30d} onChange={(n) => set("tapUsdPer30d", n)} /></Field>
              <Field label="Tap cap" hint="% of treasury per 30 days, max 10"><Num value={t.tapCapBps / 100} onChange={(n) => set("tapCapBps", Math.round(n * 100))} /></Field>
              <Field label="Exit streak" hint={demo ? "minutes under book" : "days under book, 1 to 14"}><Num value={t.exitStreak / UNIT} onChange={(n) => set("exitStreak", n * UNIT)} /></Field>
              <Field label="Exit round" hint={demo ? "minutes" : "days, at least 3"}><Num value={t.roundLength / UNIT} onChange={(n) => set("roundLength", n * UNIT)} /></Field>
              <Field label="Exit fee" hint="%, max 3, zero at wind-down"><Num value={t.exitFeeBps / 100} onChange={(n) => set("exitFeeBps", Math.round(n * 100))} /></Field>
              <Field label="Heartbeat" hint={demo ? "minutes" : "days, 14 to 90"}><Num value={t.heartbeat / UNIT} onChange={(n) => set("heartbeat", n * UNIT)} /></Field>
            </div>
            <Note tone="good" icon="check"><b>Exit rule, as fixed after review.</b> The streak decays instead of resetting (an hour above book takes an hour off), compares on-chain numbers only, and never waits on pool depth or Atlas. Depth and Atlas guard team unlocks.</Note>
          </Section>
        </div>

        <div className="stack" style={{ position: "sticky", top: 76 }}>
          <div className="card sky-soft">
            <div className="card-head"><h3 className="d4">Live preview</h3><span className="tiny muted">BNB/USD assumed at $600</span></div>
            <div className="card-body stack">
              <dl className="kv">
                <dt>Sale price at the cap</dt><dd>{price(atCap.salePrice)}</dd>
                <dt>Pool seed at the cap</dt><dd>{bnb(atCap.qPool)} BNB + {tokens(sp.P)}</dd>
                <dt>Treasury at the cap</dt><dd>{bnb(atCap.T0)} BNB</dd>
                <dt>Treasury at the minimum</dt><dd>{bnb(atMin.T0)} BNB</dd>
                <dt>Starting floor</dt><dd>{pct(ratio, 1)} of sale price</dd>
                <dt>Tap at the cap</dt><dd>{bnb(budget.bnb)} BNB / 30d ({budget.binding === "cap" ? "cap binds" : usd(t.tapUsdPer30d)})</dd>
              </dl>
              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>Floor as a share of the sale price, cap binding, no tax</div>
                {[0, 6, 12, 24].map((m) => (
                  <div key={m} style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr) 52px", gap: 10, alignItems: "center", marginBottom: 6 }}>
                    <span className="tiny muted">{m} months</span>
                    <Meter small value={floorAfterMonths(m, t.tapCapBps, ratio)} max={1} />
                    <span className="mono tiny ink" style={{ textAlign: "right" }}>{pct(floorAfterMonths(m, t.tapCapBps, ratio), 1)}</span>
                  </div>
                ))}
                <p className="tiny muted" style={{ margin: "6px 0 0" }}>Runway to a quarter of the treasury: {runwayMonths(t.tapCapBps).toFixed(0)} months.</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3 className="d4">Token address</h3><span className="tiny muted">Flap needs it to end in 7777</span></div>
            <div className="card-body stack">
              {mine.state === "found" ? (
                <>
                  <div className="mono small" style={{ overflowWrap: "anywhere" }}>{mine.address!.slice(0, -4)}<b style={{ color: "var(--accent)" }}>{mine.address!.slice(-4)}</b></div>
                  <p className="tiny muted" style={{ margin: 0 }}>Found after {mine.tries.toLocaleString("en-US")} tries in {(mine.ms! / 1000).toFixed(1)} s. Salt <span className="mono">{mine.salt!.slice(0, 12)}…</span></p>
                </>
              ) : mine.state === "mining" ? (
                <>
                  <Meter value={mine.tries} max={Math.max(65_536, mine.tries * 1.2)} label="Salt mining progress" />
                  <p className="tiny muted" style={{ margin: 0 }}>{mine.tries.toLocaleString("en-US")} tries · {Math.round(mine.rate).toLocaleString("en-US")}/s · about 65,536 on average</p>
                </>
              ) : <p className="small muted" style={{ margin: 0 }}>The app predicts the token&apos;s clone address from the Portal and the tax token implementation, in a background worker.</p>}
              <button className="btn btn-ghost" onClick={startMining} disabled={mine.state === "mining"}><Icon name="sparkle" size={16} />{mine.state === "found" ? "Mine again" : mine.state === "mining" ? "Mining…" : "Mine a 7777 salt"}</button>
            </div>
          </div>

          {problems.length ? (
            <div className="note warn"><Icon name="alert" size={16} style={{ color: "var(--warn)" }} /><div>{problems.map((p) => <div key={p}>{p}</div>)}</div></div>
          ) : null}
          {err ? <Note tone="warn" icon="alert">{err}</Note> : null}
          <button className="btn btn-primary btn-lg btn-block" disabled={problems.length > 0 || mine.state !== "found" || busy} onClick={() => void create()}>
            {busy ? "Creating…" : mine.state !== "found" ? "Mine a salt to create" : "Create covenant"}
          </button>
          <p className="tiny muted" style={{ margin: 0, textAlign: "center" }}>{src.mode === "live" ? "Sends the create transaction on the local chain." : "Demo data: creates the covenant on the mock layer."}</p>
        </div>
      </div>
    </main>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="card-head"><div><h3 className="d4">{title}</h3><p className="tiny muted" style={{ margin: "2px 0 0" }}>{sub}</p></div></div>
      <div className="card-body stack">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label style={{ display: "block", minWidth: 0 }}><span className="label">{label}{hint ? <span className="hint">{hint}</span> : null}</span>{children}</label>;
}

function Num({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [s, setS] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); if (Number(s) !== value) setS(String(value)); }
  return <input className="field mono" inputMode="decimal" value={s} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setS(v); onChange(Number(v) || 0); }} />;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="row between small"><span className="ink">{label}</span><span className="mono ink">{bps(value)}</span></div>
      <input className="range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}
