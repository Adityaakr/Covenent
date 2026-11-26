"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { Icon, type IconName } from "@/components/app/icons";
import { Meter, Note, Segmented, TokenAvatar, cx } from "@/components/app/ui";
import { useWallet } from "@/components/providers";
import { agentOwner, checkTerms, createCovenantLive, createTargets, factoryVerdict, flapFloor, readProfile, registerAgent, screenName, type FactoryKind } from "@/lib/chain/create";
import { chainName, networkKind } from "@/lib/chain/chains";
import { BnbCoin, withBnb } from "@/components/app/bnb";
import { UsdtCoin } from "@/components/app/usdt";
import { DraftMoneyMap, DraftRunway, DraftUnlocks, FloorCallout, Glance, type DraftModel } from "@/components/app/create-preview";
import { addressOf } from "@/lib/chain/deployment";
import type { MineMessage } from "@/lib/chain/salt";
import { askToFill, ceilBnb, checkCreate, DEMO_PROFILE, PRODUCTION_PROFILE, type Field, type Issue } from "@/lib/covenant/create-check";
import { DEFAULT_TERMS, DEMO_TIMERS, FLAP, FLAP_TAX } from "@/lib/covenant/defaults";
import { settleRaise, split } from "@/lib/covenant/math";
import { DAY, longSpan, span } from "@/lib/covenant/time";
import type { Address, Terms } from "@/lib/covenant/types";
import { useSource } from "@/lib/data/hooks";
import { repoFile } from "@/lib/repo";
import { useBnbUsd } from "@/lib/data/bnb-usd";
import { bnb, bps, multiple, short, usd } from "@/lib/format";
import { LOCAL_MODE } from "@/lib/chain/target";
import { ThinkingMark } from "@/components/app/mark";

type Mine = { state: "idle" | "mining" | "found"; tries: number; rate: number; salt?: `0x${string}`; address?: Address; ms?: number };

const STEPS: { title: string; sub: string; icon: IconName }[] = [
  { title: "Token and issuer", sub: "Who raises, what buyers receive, and which factory's clock it runs on.", icon: "user" },
  { title: "Raise", sub: "A minimum and a cap in BNB. Below the minimum everyone is refunded; above the cap everyone is scaled back pro rata.", icon: "coins" },
  { title: "Supply and unlocks", sub: "More pool means deeper liquidity and a lower floor to clear. The team's share unlocks only at price multiples.", icon: "pie" },
  { title: "Treasury rules", sub: "The tap, the trading tax, the exit at book and the heartbeat. The factory enforces every bound.", icon: "shield" },
  { title: "Review and launch", sub: "Check the terms, mine the token address, and create the covenant from your wallet.", icon: "rocket" },
];

/** The form field each Terms key belongs to, for the inline message under it. */
const FIELD_OF: Partial<Record<keyof Terms, Field>> = {
  name: "name", symbol: "symbol", meta: "meta", teamWallet: "teamWallet", minRaise: "minRaise", cap: "cap", saleDuration: "saleDuration",
  saleBps: "saleBps", poolBps: "poolBps", trancheBps: "tranches", trancheMultiple: "tranches", cliff: "cliff", unlockWindow: "unlockWindow",
  tapUsdPer30d: "tapUsdPer30d", tapCapBps: "tapCapBps", exitStreak: "exitStreak", roundLength: "roundLength", cooldown: "cooldown",
  exitFeeBps: "exitFeeBps", heartbeat: "heartbeat", buyTaxBps: "tax", sellTaxBps: "tax", taxDuration: "taxDuration",
};

export default function CreatePage() {
  return <Suspense fallback={<main className="page" />}><CovenantCreate /></Suspense>;
}

function CovenantCreate() {
  const router = useRouter();
  const src = useSource();
  const wallet = useWallet();
  const config = useConfig();
  const qc = useQueryClient();
  // An Covenant AI draft (the create card's "Edit in Create") opens with its terms filled in.
  const draftParam = useSearchParams().get("draft");
  const [draft] = useState(() => readDraft(draftParam));
  const [t, setT] = useState<Terms>(draft?.terms ?? { ...DEFAULT_TERMS, name: "", symbol: "", meta: "", teamWallet: (wallet.address as Address) ?? (LOCAL_MODE ? DEFAULT_TERMS.teamWallet : ("" as Address)) });
  const [issuerKind, setIssuerKind] = useState<"agent" | "human">(draft ? (draft.terms.agentId > 0 ? "agent" : "human") : "agent");
  // A local chain keeps the dev stack's worked example; a hosted build starts empty (the team wallet fills from the wallet).
  const [agentId, setAgentId] = useState(draft ? (draft.terms.agentId > 0 ? String(draft.terms.agentId) : "") : LOCAL_MODE ? "4127" : "");
  // Live only: the short-timer demo factory (time in minutes) or the production factory (time in days)
  const [factory, setFactory] = useState<FactoryKind>(draft?.factory ?? "demo");
  const live = src.mode === "live";
  const demo = live && factory === "demo";
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
    if (src.mode === "live" && !draft) setT((x) => ({ ...x, ...timers(factory) }));
  }
  const [seenWallet, setSeenWallet] = useState<string | undefined>(undefined);
  if (wallet.address && seenWallet !== wallet.address) {
    setSeenWallet(wallet.address);
    if (t.teamWallet === DEFAULT_TERMS.teamWallet || !t.teamWallet) setT((x) => ({ ...x, teamWallet: wallet.address as Address }));
  }
  const [mine, setMine] = useState<Mine>({ state: "idle", tries: 0, rate: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  // Flap is the only venue on testnet. Covenant Lite (Four.meme) needs Four.meme's mainnet token backend, so its option
  // is shown but cannot be picked; /app/create?venue=fourmeme (older links) lands here with that note highlighted.
  const askedFour = useSearchParams().get("venue") === "fourmeme";
  const [step, setStep] = useState(0);
  // Steps whose problems show in full (Continue was pressed there, or a draft arrived), and fields edited so far.
  const [tried, setTried] = useState<number[]>(draft ? [0, 1, 2, 3] : []);
  const [seen, setSeen] = useState<number[]>(draft ? [0, 1, 2, 3] : [0]);
  const [touched, setTouched] = useState<Field[]>([]);
  const touch = (f: Field | undefined) => { if (f && !touched.includes(f)) setTouched((x) => [...x, f]); };
  const set = <K extends keyof Terms>(k: K, val: Terms[K]) => { setT((x) => ({ ...x, [k]: val })); touch(FIELD_OF[k]); };
  const patch = (p: Partial<Terms>) => { setT((x) => ({ ...x, ...p })); for (const k of Object.keys(p) as (keyof Terms)[]) touch(FIELD_OF[k]); };
  const go = (k: number) => { setStep(k); if (!seen.includes(k)) setSeen((x) => [...x, k]); };

  const teamBps = 10_000 - t.saleBps - t.poolBps;
  const sp = split(t.totalSupply, t.saleBps, t.poolBps);
  const atMin = settleRaise(t.minRaise, t.minRaise, t.cap, sp);
  const atCap = settleRaise(t.cap, t.minRaise, t.cap, sp);
  // BNB/USD from Atlas through our oracle, live; the tap at the cap is priced at it (none shown while it is unknown).
  const rateQ = useBnbUsd();
  const bnbUsd = rateQ.data ?? null;
  const tg = useMemo(() => createTargets(src.payload, factory), [src.payload, factory]);
  // Flap's liquidity floor for this split, read live from the Portal through the factory (minRaiseFor): the pool seed
  // of the minimum raise must clear the floor with the factory's safety margin, or the factory refuses it.
  const floorQ = useQuery({
    queryKey: ["flap-floor", src.chainId, factory, t.totalSupply, t.saleBps, t.poolBps],
    enabled: live && Boolean(src.client),
    staleTime: 60_000,
    queryFn: () => flapFloor(src.client!, tg, t.totalSupply, t.saleBps, t.poolBps),
  });
  const floor = floorQ.data ?? null;
  // The factory's own time bounds (CovenantProfiles), read from the chain; the built-in copies stand in until then.
  const profileQ = useQuery({
    queryKey: ["factory-profile", src.chainId, factory],
    enabled: live && Boolean(src.client),
    staleTime: Infinity,
    queryFn: () => readProfile(src.client!, tg),
  });
  const profile = profileQ.data ?? (demo ? DEMO_PROFILE : PRODUCTION_PROFILE);

  const issues = useMemo(() => checkCreate(t, { profile, floor, issuer: issuerKind, agentId, unit: UNIT }), [t, profile, floor, issuerKind, agentId, UNIT]);

  // Flap's name screen, the same call the factory makes; debounced while typing.
  const nameKey = useDebounced(`${t.name}\u0000${t.symbol}`, 450);
  const [dName, dSymbol] = nameKey.split("\u0000") as [string, string];
  const screenQ = useQuery({
    queryKey: ["name-screen", src.chainId, factory, nameKey],
    enabled: live && Boolean(src.client) && dName.trim().length > 0 && /^[A-Z0-9]{2,10}$/.test(dSymbol),
    staleTime: 5 * 60_000,
    queryFn: () => screenName(src.client!, tg, dName, dSymbol),
  });
  const screen = screenQ.data ?? null;
  const screenIssues: Issue[] = [];
  if (screen?.name && dName === t.name) screenIssues.push({ field: "name", step: 0, msg: `"${t.name}" is on Flap's list of blocked names: Flap would refuse the launch. Pick another name.` });
  if (screen?.symbol && dSymbol === t.symbol) screenIssues.push({ field: "symbol", step: 0, msg: `"${t.symbol}" is on Flap's list of blocked symbols: Flap would refuse the launch. Pick another symbol.` });
  const allIssues = [...issues, ...screenIssues];

  // With the form clean, the factory's checkTerms itself: the name screen, Flap's floor and the agent's owner, as the
  // transaction will meet them. Debounced, and only when nothing local is left to fix.
  const verdictTerms = useMemo(() => ({ ...t, agentId: issuerKind === "agent" ? Number(agentId) : 0 }), [t, issuerKind, agentId]);
  const verdictKey = useDebounced(JSON.stringify(verdictTerms), 600);
  const verdictQ = useQuery({
    queryKey: ["check-terms", src.chainId, factory, verdictKey],
    enabled: live && Boolean(src.client) && allIssues.length === 0 && Boolean(tg.factory),
    staleTime: 30_000,
    queryFn: () => factoryVerdict(src.client!, tg, JSON.parse(verdictKey) as Terms),
  });
  const verdictFresh = verdictKey === JSON.stringify(verdictTerms);
  const verdict = allIssues.length === 0 && verdictFresh ? verdictQ.data ?? null : null;
  const refused = verdict && !verdict.ok ? verdict : null;

  const stepIssues = (k: number) => allIssues.filter((x) => x.step === k);
  const show = (f: Field) => {
    const i = allIssues.find((x) => x.field === f);
    if (!i) return undefined;
    return touched.includes(f) || tried.includes(i.step) || screenIssues.some((s) => s.field === f) ? i : undefined;
  };
  const fieldProps = (f: Field) => ({ issue: show(f), onFix: (p: Partial<Terms>) => patch(p) });

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
    if (src.mode !== "live") { setErr(LOCAL_MODE ? `No chain to create on: ${src.reason}. Start the stack with scripts/dev-all.sh.` : `${chainName(97)} did not answer just now; try again in a moment.`); return; }
    // Live: Portal.newLauncher(factory, abi.encode(Terms)), Terms encoded from the factory's own checkTerms input.
    const d = src.payload!.deployment!;
    if (!tg.portal || !tg.factory || !tg.termsParam) { setErr("The deployment names no Flap Portal and covenant launcher factory."); return; }
    if (!wallet.address) { wallet.connect(); return; }
    if (!mine.salt) { setErr("Mine a 7777 salt first."); return; }
    setBusy(true);
    try {
      if (terms.agentId > 0 && tg.identityRegistry) {
        const owner = await agentOwner(src.client!, tg.identityRegistry, BigInt(terms.agentId));
        if (!owner) throw new Error(`Agent #${terms.agentId} is not registered on this chain. Register one in step 1.`);
        if (owner.toLowerCase() !== terms.teamWallet.toLowerCase()) throw new Error(`Agent #${terms.agentId} belongs to ${owner}, not the team wallet.`);
      }
      const why = await checkTerms(src.client!, tg, terms, mine.salt);
      if (why) throw new Error(`The factory refuses these terms: ${why}`);
      const { launcher } = await createCovenantLive(config, src.client!, d.chainId, tg, terms, mine.salt);
      // rediscover launchers so the new one opens at once (the page keeps looking for a few seconds if an RPC lags)
      await qc.invalidateQueries({ queryKey: ["source"] });
      void qc.invalidateQueries({ queryKey: ["covenants"] });
      router.push(launcher ? `/app/c/${launcher}/raise` : "/app");
    } catch (e) {
      setErr((e as { shortMessage?: string }).shortMessage ?? (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setErr(null);
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

  function applyMinimum() {
    if (!floor) return;
    const need = ceilBnb(floor.minRaise);
    patch({ minRaise: need, cap: Math.max(t.cap, need) });
  }

  const askHref = `/app/ask?q=${encodeURIComponent(askToFill(t, { issuer: issuerKind, agentId, factory, unit: UNIT, problems: allIssues.map((x) => x.msg) }))}`;
  const here = stepIssues(step);
  const last = step === STEPS.length - 1;
  const model: DraftModel = { t, issuer: issuerKind, sp, atMin, atCap, bnbUsd };
  const summary = [
    t.name.trim() ? `${t.name.trim()}${t.symbol ? ` · $${t.symbol}` : ""}` : "Not named yet",
    `${fmt(t.minRaise)}–${fmt(t.cap)} BNB`,
    `${bps(t.saleBps)} · ${bps(t.poolBps)} · ${bps(Math.max(0, teamBps))}`,
    `${usd(t.tapUsdPer30d)}/30d · ${bps(t.tapCapBps)}`,
    allIssues.length ? `${allIssues.length} to fix` : mine.state === "found" ? "Ready to create" : "Mine, then create",
  ];
  const ready = allIssues.length === 0 && !refused;

  const checkPanel = (
    <div className={cx("cr-check", !live ? "idle" : allIssues.length ? "warn" : refused ? "bad" : verdict?.ok ? "ok" : "idle")}>
      <span className="cr-check-ic">{!live ? <Icon name="shield" size={15} /> : allIssues.length ? <Icon name="alert" size={15} /> : refused ? <Icon name="x" size={15} /> : verdict?.ok ? <Icon name="check" size={15} strokeWidth={2.2} /> : <ThinkingMark size={15} />}</span>
      <div style={{ minWidth: 0 }}>
        <b>{!live ? "Factory check" : allIssues.length ? `${allIssues.length} thing${allIssues.length === 1 ? "" : "s"} to fix` : refused ? "The factory refuses these terms" : verdict?.ok ? "The factory accepts these terms" : "Asking the factory…"}</b>
        <span>{!live ? "Runs the launcher factory's checkTerms once the chain answers." : allIssues.length ? "Each one is marked on its step, with a fix where there is one." : refused ? refused.reason : verdict?.ok ? "checkTerms passes on chain: bounds, Flap's floor, the name screen, the agent." : "checkTerms on chain: bounds, Flap's floor, the name screen, the agent."}</span>
      </div>
    </div>
  );

  return (
    <main className="page">
      <div className="sec-head">
        <div className="stack-sm" style={{ display: "grid" }}>
          <span className="eyebrow">Create a covenant</span>
          <h1 className="h-page">Write the covenant</h1>
          <p className="lede">Five steps, checked as you type against the same rules the launcher factory enforces. Nothing can be edited later except lowering the tap.</p>
        </div>
        <div className="row wrap-ok" style={{ gap: 10 }}>
          <span className={cx("srcpill", src.mode === "live" ? "live" : "mock")} style={{ height: 30 }} title={src.reason}>{src.mode === "live" ? <>Creates on {src.chainId && networkKind(src.chainId) !== "local" ? withBnb(chainName(src.chainId)) : "the local chain"}</> : src.mode === "checking" ? "Checking the chain" : "Offline: connect to create"}</span>
          <Link className="btn btn-secondary btn-sm" href={askHref} title="Opens Covenant AI with this form's terms and what is left to fix"><Icon name="sparkle" size={14} />Fill with Covenant AI</Link>
        </div>
      </div>

      <div className="choice venue" role="group" aria-label="Where to launch">
        <button type="button" aria-pressed="true"><span className="icon-tile accent"><Icon name="vault" size={17} /></span><span><b className="t-s ink" style={{ display: "block" }}>Flap Pool Launch</b><span className="t-xs muted w5">The full five rules: raise with refunds, vault, exit at book, unlocks, disclosure</span></span><span className="radio" /></button>
        <button type="button" disabled aria-disabled="true" aria-describedby="lite-note"><span className="icon-tile"><Icon name="coins" size={17} /></span><span><span className="row" style={{ gap: 8, rowGap: 4, flexWrap: "wrap" }}><b className="t-s ink">Four.meme tax token</b><span className="soon-tag">Mainnet · coming soon</span></span><span className="t-xs muted w5">Covenant Lite: a budget cap and the abandonment switch on the founder&apos;s tax</span></span><span /></button>
      </div>
      <p id="lite-note" className={cx("t-xs w5 lite-note", askedFour ? "ink" : "muted")}>
        Covenant Lite plugs into Four.meme tax tokens through OpenFour. Token creation runs on Four.meme&apos;s mainnet backend, so it is not available on testnet yet.{" "}
        <a href={repoFile("contracts/src/openfour/CovenantLiteVault.sol")} target="_blank" rel="noopener noreferrer">CovenantLiteVault source</a>
        {" · "}
        <a href={repoFile("contracts/test/unit/LiteVault.t.sol")} target="_blank" rel="noopener noreferrer">its tests</a>
      </p>

      <nav className="cr-steps" aria-label="Steps">
        {STEPS.map((s, k) => {
          const n = k < 4 ? stepIssues(k).length : allIssues.length;
          const state = k === step ? "current" : !seen.includes(k) ? "todo" : n > 0 && (k === 4 || tried.includes(k) || k < step) ? "bad" : k < 4 && n === 0 ? "ok" : "todo";
          return (
            <button key={s.title} type="button" className="cr-step" data-state={state} aria-current={k === step ? "step" : undefined} onClick={() => go(k)}>
              <span className="n">{state === "ok" ? <Icon name="check" size={12} strokeWidth={2.4} /> : state === "bad" ? <Icon name="alert" size={12} /> : k + 1}</span>
              <b>{s.title}</b>
              <small className="num">{summary[k]}</small>
            </button>
          );
        })}
      </nav>

      <div className="grid-side">
        <div className="card">
          <div className="card-head ruled">
            <div className="row" style={{ gap: 12, minWidth: 0, flex: "1 1 320px" }}><span className="icon-tile accent"><Icon name={STEPS[step]!.icon} size={17} /></span><div style={{ minWidth: 0 }}><h2 className="h-card">{STEPS[step]!.title}</h2><p className="t-xs muted w5">{STEPS[step]!.sub}</p></div></div>
            <span className="t-xs muted w5 num">Step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="card-body ruled form-step rise" key={step}>
            {step === 0 ? (
              <>
                <div className="cr-ask">
                  <span className="icon-tile accent sm"><Icon name="sparkle" size={14} /></span>
                  <span className="t-s muted w5">Not sure where to start? Covenant AI drafts terms from a sentence and checks them against the factory; you edit the draft here.</span>
                  <Link className="btn btn-ghost btn-sm" href={askHref}>Fill with Covenant AI<Icon name="arrow" size={14} /></Link>
                </div>
                <div className="grid2">
                  <Field label="Name" hint={screen && !screen.name && t.name.trim() && dName === t.name ? "clear on Flap's name screen" : undefined} {...fieldProps("name")}><input className="field" value={t.name} placeholder="Lumen" maxLength={64} onChange={(e) => set("name", e.target.value)} /></Field>
                  <Field label="Symbol" hint="2 to 10 letters or digits" {...fieldProps("symbol")}><input className="field mono" value={t.symbol} placeholder="LUMEN" onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} /></Field>
                </div>
                <Field label="What it does" hint={`shown on the covenant page · ${new TextEncoder().encode(t.meta).length}/512`} {...fieldProps("meta")}><input className="field" value={t.meta} placeholder="An AI research agent that sells market briefs to other agents" onChange={(e) => set("meta", e.target.value)} /></Field>
                <div>
                  <span className="label">Issuer</span>
                  <div className="choice" role="group" aria-label="Issuer">
                    <button type="button" aria-pressed={issuerKind === "agent"} onClick={() => setIssuerKind("agent")}><span className="icon-tile agent"><Icon name="agent" size={17} /></span><span><b className="t-s ink" style={{ display: "block" }}>AI agent</b><span className="t-xs muted w5">With an ERC-8004 identity and a track record</span></span><span className="radio" /></button>
                    <button type="button" aria-pressed={issuerKind === "human"} onClick={() => setIssuerKind("human")}><span className="icon-tile"><Icon name="team" size={17} /></span><span><b className="t-s ink" style={{ display: "block" }}>Human team</b><span className="t-xs muted w5">Bound through the team wallet</span></span><span className="radio" /></button>
                  </div>
                </div>
                <div className="grid2">
                  <Field label="Team wallet" hint="receives the tap, fixed forever" {...fieldProps("teamWallet")}><input className="field mono" value={t.teamWallet} placeholder="Your wallet, once connected" onChange={(e) => set("teamWallet", e.target.value.trim() as Address)} /></Field>
                  {issuerKind === "agent" ? <Field label="Agent id" hint="owned by the team wallet" issue={show("agentId") ?? (refused?.field === "agentId" ? { field: "agentId", step: 0, msg: refused.reason } : undefined)}><input className="field mono" value={agentId} inputMode="numeric" placeholder="ERC-8004 id" onChange={(e) => { setAgentId(e.target.value.replace(/[^0-9]/g, "")); touch("agentId"); }} /></Field> : <div />}
                </div>
                {live && issuerKind === "agent" ? (
                  <div className="tile row between wrap-ok" style={{ gap: 12 }}>
                    <span className="t-s muted w5" style={{ flex: "1 1 260px" }}>{agentNote ?? "No agent identity yet? Register one from the connected wallet in the ERC-8004 identity registry; it becomes the team wallet."}</span>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void register()}><Icon name="agent" size={14} />Register agent identity</button>
                  </div>
                ) : null}
                {live ? (
                  <div>
                    <span className="label">Launcher factory <span className="hint">same five rules, different clocks</span></span>
                    <Segmented label="Launcher factory" value={factory} onChange={pickFactory} options={[{ value: "demo", label: "Demo timers (minutes)" }, { value: "production", label: "Production (days)" }]} />
                    <p className="t-xs muted w5" style={{ marginTop: 8 }}>{factory === "demo" ? "Every timer runs in minutes, so a whole lifecycle fits a demo. Flap's launch floor applies, with the 1.5x margin." : "Timers in days, as the design document sets them. Flap's graduation floor applies, with the 1.5x margin."}</p>
                  </div>
                ) : null}
              </>
            ) : step === 1 ? (
              <>
                <RaiseIn />
                <FloorCallout floor={floor} live={live} loading={floorQ.isFetching} minRaise={t.minRaise} poolBps={t.poolBps} onUseMin={applyMinimum} />
                <div className="grid3">
                  <Field label="Minimum" hint="BNB" {...fieldProps("minRaise")}><Num value={t.minRaise} onChange={(n) => set("minRaise", n)} unit="BNB" /></Field>
                  <Field label="Cap" hint="BNB" {...fieldProps("cap")}><Num value={t.cap} onChange={(n) => set("cap", n)} unit="BNB" /></Field>
                  <Field label="Sale window" hint={unit} {...fieldProps("saleDuration")}><Num value={t.saleDuration / UNIT} onChange={(n) => set("saleDuration", Math.round(n * UNIT))} unit={unit} /></Field>
                </div>
                <div className="review">
                  <div><span className="t-xs muted w5">At the minimum</span><span className="num ink">{bnb(atMin.T0)} BNB to the vault</span><span className="t-xs muted w5 num">pool seed {bnb(atMin.qPool)} BNB</span></div>
                  <div><span className="t-xs muted w5">At the cap</span><span className="num ink">{bnb(atCap.T0)} BNB to the vault</span><span className="t-xs muted w5 num">pool seed {bnb(atCap.qPool)} BNB</span></div>
                </div>
                <Note tone="accent">Below the minimum, everyone is refunded in full. A launch that reverts also refunds in full. The factory checks Flap&apos;s floor and its name blocklist before the raise opens, so terms Flap would refuse never collect money.</Note>
              </>
            ) : step === 2 ? (
              <>
                <div className="split-bar" aria-label="Supply split">
                  <div style={{ flexGrow: t.saleBps, flexBasis: 0, background: "var(--accent-strong)" }}>Sale {bps(t.saleBps)}</div>
                  <div style={{ flexGrow: t.poolBps, flexBasis: 0, background: "var(--good)" }}>{t.poolBps >= 1000 ? `Pool ${bps(t.poolBps)}` : ""}</div>
                  <div style={{ flexGrow: Math.max(0, teamBps), flexBasis: 0, background: "var(--agent)" }}>{teamBps >= 1000 ? `Team ${bps(teamBps)}` : ""}</div>
                </div>
                <Slider label="Sale" hint="at least 40%" value={t.saleBps} min={4000} max={9000} step={500} onChange={(n) => set("saleBps", n)} issue={show("saleBps")} onFix={patch} />
                <Slider label="Pool" hint="5% up to the sale share; more lowers Flap's minimum" value={t.poolBps} min={500} max={Math.min(t.saleBps, 3000)} step={250} onChange={(n) => set("poolBps", n)} issue={show("poolBps")} onFix={patch} />
                <div className="row between t-s w5"><span className="muted">Team, at most 30%, locked until the price holds each multiple</span><span className="num ink">{bps(teamBps)}</span></div>
                <div>
                  <span className="label">Team tranches <span className="hint">share of supply, and the multiple of the sale price that unlocks it</span></span>
                  <div className="cr-tranches">
                    {t.trancheBps.map((b, k) => (
                      <div key={k} className="cr-tranche">
                        <span className="cr-tranche-n num">{k + 1}</span>
                        <div className="ig"><input className="field mono" inputMode="decimal" aria-label={`Tranche ${k + 1} share`} value={b / 100} onChange={(e) => { const n = Math.round((Number(e.target.value) || 0) * 100); setT((x) => ({ ...x, trancheBps: x.trancheBps.map((y, i) => (i === k ? n : y)) })); touch("tranches"); }} /><span className="unit">%</span></div>
                        <span className="t-xs muted w5">at</span>
                        <div className="ig"><input className="field mono" inputMode="decimal" aria-label={`Tranche ${k + 1} multiple`} value={(t.trancheMultiple[k] ?? 0) / 100} onChange={(e) => { const n = Math.round((Number(e.target.value) || 0) * 100); setT((x) => ({ ...x, trancheMultiple: x.trancheMultiple.map((y, i) => (i === k ? n : y)) })); touch("tranches"); }} /><span className="unit">x</span></div>
                      </div>
                    ))}
                  </div>
                  <FieldIssue issue={show("tranches")} onFix={patch} />
                </div>
                <div className="grid2">
                  <Field label="Cliff" hint={`${unit} before any tranche can unlock`} {...fieldProps("cliff")}><Num value={t.cliff / UNIT} onChange={(n) => set("cliff", Math.round(n * UNIT))} unit={unit} /></Field>
                  <Field label="Unlock window" hint={`${unit} the price must hold a multiple`} {...fieldProps("unlockWindow")}><Num value={t.unlockWindow / UNIT} onChange={(n) => set("unlockWindow", Math.round(n * UNIT))} unit={unit} /></Field>
                </div>
              </>
            ) : step === 3 ? (
              <>
                <Group title="Tap" sub="the only way the team reaches the treasury">
                  <div className="grid2">
                    <Field label="Tap budget" hint="USD per 30 days" {...fieldProps("tapUsdPer30d")}><Num value={t.tapUsdPer30d} onChange={(n) => set("tapUsdPer30d", n)} unit="USD" /></Field>
                    <Field label="Tap cap" hint="% of treasury per 30 days, max 10" {...fieldProps("tapCapBps")}><Num value={t.tapCapBps / 100} onChange={(n) => set("tapCapBps", Math.round(n * 100))} unit="%" /></Field>
                  </div>
                </Group>
                <Group title="Trading tax" sub="the treasury's revenue stream">
                  <div className="grid3">
                    <Field label="Buy tax" hint="%, max 10" issue={show("tax")} onFix={patch}><Num value={t.buyTaxBps / 100} onChange={(n) => set("buyTaxBps", Math.round(n * 100))} unit="%" /></Field>
                    <Field label="Sell tax" hint="%, max 10"><Num value={t.sellTaxBps / 100} onChange={(n) => set("sellTaxBps", Math.round(n * 100))} unit="%" /></Field>
                    <Field label="Runs for" hint="years, 30 days to 100" {...fieldProps("taxDuration")}><Num value={+(t.taxDuration / (365 * DAY)).toFixed(4)} onChange={(n) => set("taxDuration", Math.round(n * 365 * DAY))} unit="years" /></Field>
                  </div>
                  <p className="t-xs muted w5">Flap&apos;s tax processor sells the collected tax in chunks of about {usd(FLAP_TAX.chunkUsd)}, at most once every {FLAP_TAX.minGapSeconds} seconds, and Flap&apos;s protocol fee takes about {bps(FLAP_TAX.protocolFeeBps)} first: the vault receives about {bps(10_000 - FLAP_TAX.protocolFeeBps)}. The higher rate must be at least 1%. When the tax ends, the treasury grows only from revenue the {issuerKind === "agent" ? "agent" : "team"} deposits.</p>
                </Group>
                <Group title="Exit at book" sub="holders vote with their feet when the price sits under book value">
                  <div className="grid2">
                    <Field label="Exit streak" hint={`${unit} under book`} {...fieldProps("exitStreak")}><Num value={t.exitStreak / UNIT} onChange={(n) => set("exitStreak", Math.round(n * UNIT))} unit={unit} /></Field>
                    <Field label="Exit round" hint={unit} {...fieldProps("roundLength")}><Num value={t.roundLength / UNIT} onChange={(n) => set("roundLength", Math.round(n * UNIT))} unit={unit} /></Field>
                    <Field label="Cooldown" hint={`${unit} between rounds`} {...fieldProps("cooldown")}><Num value={t.cooldown / UNIT} onChange={(n) => set("cooldown", Math.round(n * UNIT))} unit={unit} /></Field>
                    <Field label="Exit fee" hint="%, max 3, zero at wind-down" {...fieldProps("exitFeeBps")}><Num value={t.exitFeeBps / 100} onChange={(n) => set("exitFeeBps", Math.round(n * 100))} unit="%" /></Field>
                  </div>
                  <p className="t-xs muted w5">The streak decays instead of resetting (an hour above book takes an hour off) and compares on-chain numbers only. Pool depth and Atlas guard team unlocks, not the exit.</p>
                </Group>
                <Group title="Heartbeat" sub={`the ${issuerKind === "agent" ? "agent" : "team"} must check in, or anyone can declare it abandoned`}>
                  <div className="grid2">
                    <Field label="Heartbeat" hint={unit} {...fieldProps("heartbeat")}><Num value={t.heartbeat / UNIT} onChange={(n) => set("heartbeat", Math.round(n * UNIT))} unit={unit} /></Field>
                    <div />
                  </div>
                </Group>
              </>
            ) : (
              <>
                <div className="row" style={{ gap: 14 }}>
                  <TokenAvatar seed={mine.address ?? (t.symbol || "new covenant")} size={52} issuer={issuerKind} />
                  <div style={{ minWidth: 0 }}><div className="h-card">{t.name || "Unnamed token"} <span className="mono t-xs muted">${t.symbol || "SYMBOL"}</span></div><p className="t-xs muted w5 trunc">{t.meta || "No description yet."}</p></div>
                </div>
                <div className="cr-review">
                  <ReviewGroup title="Token and issuer" bad={stepIssues(0).length} onEdit={() => go(0)} rows={[
                    ["Issuer", issuerKind === "agent" ? `AI agent #${agentId || "?"}` : "Human team"],
                    ["Team wallet", t.teamWallet ? short(t.teamWallet, 8, 6) : "Connect a wallet"],
                    ["Factory", live ? (demo ? "Demo timers (minutes)" : "Production (days)") : "–"],
                  ]} />
                  <ReviewGroup title="Raise" bad={stepIssues(1).length} onEdit={() => go(1)} rows={[
                    ["Minimum to cap", `${fmt(t.minRaise)} to ${fmt(t.cap)} BNB`],
                    ["Flap's minimum", floor ? `${fmt(ceilBnb(floor.minRaise))} BNB` : live ? "Reading…" : "–"],
                    ["Sale window", span(t.saleDuration)],
                  ]} />
                  <ReviewGroup title="Supply and unlocks" bad={stepIssues(2).length} onEdit={() => go(2)} rows={[
                    ["Split", `${bps(t.saleBps)} sale · ${bps(t.poolBps)} pool · ${bps(teamBps)} team`],
                    ["Tranches", t.trancheBps.map((b, k) => `${bps(b)} at ${multiple(t.trancheMultiple[k] ?? 0)}`).join(", ")],
                    ["Cliff, window", `${t.cliff ? span(t.cliff) : "none"}, ${span(t.unlockWindow)}`],
                  ]} />
                  <ReviewGroup title="Treasury rules" bad={stepIssues(3).length} onEdit={() => go(3)} rows={[
                    ["Tap", `${usd(t.tapUsdPer30d)} / 30d, cap ${bps(t.tapCapBps)}`],
                    ["Trading tax", `${bps(t.buyTaxBps)} buy · ${bps(t.sellTaxBps)} sell, ${longSpan(t.taxDuration)}`],
                    ["Exit", `${span(t.exitStreak)} streak, ${span(t.roundLength)} round, ${bps(t.exitFeeBps)} fee`],
                    ["Heartbeat", span(t.heartbeat)],
                  ]} />
                </div>
                {checkPanel}
                {allIssues.length ? <Problems list={allIssues} onFix={patch} onGo={go} /> : null}
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
                  <button className="btn btn-secondary" onClick={startMining} disabled={mine.state === "mining"}><Icon name="sparkle" size={15} />{mine.state === "found" ? "Mine again" : mine.state === "mining" ? <><ThinkingMark size={15} />Mining…</> : "Mine a 7777 salt"}</button>
                </div>
                {src.mode !== "live" ? (LOCAL_MODE
                  ? <Note tone="warn" icon="alert"><b>Not connected to the local chain.</b> {src.reason}. Start the stack with <span className="mono">scripts/dev-all.sh</span>; creating sends the transaction there.</Note>
                  : <Note tone="warn" icon="alert"><b>Reading {chainName(97)}…</b> The network did not answer just now; creating is available as soon as it does.</Note>) : null}
                {err ? <Note tone="warn">{err}</Note> : null}
              </>
            )}
            {!last && here.length && tried.includes(step) ? <Problems list={here} onFix={patch} /> : null}
          </div>
          <div className="card-foot">
            <button className="btn btn-ghost" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}><Icon name="back" size={15} />Back</button>
            {last ? (
              <button className="btn btn-primary btn-lg" disabled={!ready || mine.state !== "found" || busy || src.mode !== "live"} onClick={() => void create()}>
                {busy ? <><ThinkingMark size={16} />Creating…</> : !ready ? "Fix the terms to create" : mine.state !== "found" ? "Mine a salt to create" : <><Icon name="rocket" size={15} />Create covenant</>}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => { if (here.length && !tried.includes(step)) setTried([...tried, step]); else go(step + 1); }}>
                {here.length && tried.includes(step) ? "Continue anyway" : `Continue to ${STEPS[step + 1]!.title.toLowerCase()}`}<Icon name="arrow" size={15} />
              </button>
            )}
          </div>
        </div>

        <aside className="stack sticky" aria-label="At a glance">
          <div className="card preview">
            <div className="card-head"><div><h3 className="h-card">At a glance</h3><p className="t-xs muted w5">{bnbUsd ? <>BNB/USD <span className="num">{usd(bnbUsd, 2)}</span>, live from Atlas</> : rateQ.isLoading ? "Reading BNB/USD from Atlas…" : "BNB/USD from Atlas is unavailable right now"}</p></div><span className={cx("badge", live ? "accent" : "")}>{live ? "Live" : "Offline"}</span></div>
            <div className="card-body">
              <Glance d={model} check={checkPanel}>
                {step !== 1 ? <FloorCallout compact floor={floor} live={live} loading={floorQ.isFetching} minRaise={t.minRaise} poolBps={t.poolBps} onUseMin={applyMinimum} /> : null}
              </Glance>
            </div>
          </div>
        </aside>
      </div>

      <div className="cr-preview-head">
        <span className="eyebrow">Preview</span>
        <h2 className="h-sec">How the covenant page will read</h2>
        <p className="t-s muted w5">The same pictures the covenant page draws, from these terms. They update as you type.</p>
      </div>
      <DraftMoneyMap d={model} />
      <DraftUnlocks d={model} />
      <DraftRunway d={model} rateLoading={rateQ.isLoading} />
    </main>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** A value that settles `ms` after the last change (for chain reads while typing). */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Problems({ list, onFix, onGo }: { list: Issue[]; onFix: (p: Partial<Terms>) => void; onGo?: (step: number) => void }) {
  return (
    <ul className="problems cr-problems" aria-label="To fix">
      {list.map((p) => (
        <li key={`${p.field}:${p.msg}`}>
          <Icon name="alert" size={13} />
          <span>{p.msg}{onGo ? <> · <button type="button" className="link" onClick={() => onGo(p.step)}>{STEPS[p.step]!.title}</button></> : null}</span>
          {p.fix ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => onFix(p.fix!.patch)}>{p.fix.label}</button> : null}
        </li>
      ))}
    </ul>
  );
}

function FieldIssue({ issue, onFix }: { issue?: Issue; onFix?: (p: Partial<Terms>) => void }) {
  if (!issue) return null;
  return (
    <span className="cr-err" role="alert">
      <Icon name="alert" size={12} />{issue.msg}
      {issue.fix && onFix ? <button type="button" className="cr-fix" onClick={() => onFix(issue.fix!.patch)}>{issue.fix.label}</button> : null}
    </span>
  );
}

function Field({ label, hint, issue, onFix, children }: { label: string; hint?: string; issue?: Issue; onFix?: (p: Partial<Terms>) => void; children: ReactNode }) {
  return (
    <div className={cx("cr-field", issue && "bad")} style={{ minWidth: 0 }}>
      <label style={{ display: "block", minWidth: 0 }}><span className="label">{label}{hint ? <span className="hint">{hint}</span> : null}</span>{children}</label>
      <FieldIssue issue={issue} onFix={onFix} />
    </div>
  );
}

function Group({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="cr-group" aria-label={title}>
      <header><b>{title}</b><span>{sub}</span></header>
      {children}
    </section>
  );
}

function ReviewGroup({ title, rows, bad, onEdit }: { title: string; rows: [string, string][]; bad: number; onEdit: () => void }) {
  return (
    <div className={cx("cr-rg", bad > 0 && "bad")}>
      <div className="row between"><b className="t-s ink">{title}{bad > 0 ? <span className="tag warn" style={{ marginLeft: 8 }}>{bad} to fix</span> : null}</b><button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button></div>
      <dl className="kv">{rows.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
    </div>
  );
}

function Num({ value, onChange, unit }: { value: number; onChange: (n: number) => void; unit?: string }) {
  const [s, setS] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); if (Number(s) !== value) setS(String(value)); }
  const input = <input className="field mono" inputMode="decimal" value={s} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setS(v); onChange(Number(v) || 0); }} />;
  return unit ? <div className="ig">{input}<span className="unit">{unit}</span></div> : input;
}

function Slider({ label, hint, value, min, max, step, onChange, issue, onFix }: { label: string; hint?: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; issue?: Issue; onFix?: (p: Partial<Terms>) => void }) {
  const fill = `${((value - min) / Math.max(1, max - min)) * 100}%`;
  return (
    <div className={cx("cr-field", issue && "bad")}>
      <div className="row between t-s w5"><span className="ink">{label}{hint ? <span className="faint t-xs" style={{ marginLeft: 8 }}>{hint}</span> : null}</span><span className="num ink">{bps(value)}</span></div>
      <input className="range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} style={{ ["--fill" as string]: fill }} />
      <FieldIssue issue={issue} onFix={onFix} />
    </div>
  );
}

/** The ?draft= parameter Covenant AI's create card links with: base64 of {factory, terms}. Anything malformed is ignored. */
function readDraft(raw: string | null): { factory: FactoryKind; terms: Terms } | null {
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const o = JSON.parse(new TextDecoder().decode(bytes)) as { factory?: string; terms?: Partial<Terms> };
    if (!o.terms || typeof o.terms.name !== "string") return null;
    const terms = { ...DEFAULT_TERMS, ...o.terms } as Terms;
    const nums: (keyof Terms)[] = ["totalSupply", "saleBps", "poolBps", "minRaise", "cap", "saleDuration", "buyTaxBps", "sellTaxBps", "tapUsdPer30d", "tapCapBps", "cliff", "unlockWindow", "exitStreak", "roundLength", "cooldown", "exitFeeBps", "heartbeat", "agentId"];
    if (nums.some((k) => typeof terms[k] !== "number" || !Number.isFinite(terms[k] as number))) return null;
    if (!Array.isArray(terms.trancheBps) || !Array.isArray(terms.trancheMultiple)) return null;
    return { factory: o.factory === "production" ? "production" : "demo", terms };
  } catch {
    return null;
  }
}

const STABLE_RAISES_SOON = "USDT and USD1 raises are next; Flap mainnet already accepts them as launch quotes.";

/** What buyers commit: BNB today. USDT is shown, disabled, as in progress (it needs a stablecoin-quoted Flap pool). */
function RaiseIn() {
  return (
    <div className="raise-in">
      <span className="lbl">Raise in</span>
      <div className="seg" role="radiogroup" aria-label="Raise in">
        <button type="button" role="radio" aria-checked="true"><BnbCoin size={16} />BNB</button>
        <button type="button" role="radio" aria-checked="false" aria-disabled="true" disabled title={STABLE_RAISES_SOON}><UsdtCoin size={16} />USDT<span className="soon-tag">In progress</span></button>
      </div>
      <span className="t-xs faint w5 raise-in-note">{STABLE_RAISES_SOON}</span>
    </div>
  );
}
