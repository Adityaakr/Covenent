"use client";

/*
 * Test funds on BNB testnet (chain 97), done for real: the Covenant server's drip sends a little tBNB from its own
 * faucet wallet, once per wallet a day, and BNB Chain's public faucets take over when it is dry or has paid already.
 *
 * - TestnetFunds: the full panel in Settings, Test funds.
 * - GetStarted: the first-run guide. After login, a wallet with no gas on chain 97 gets three steps (gas, a first
 *   commitment, the portfolio), each checked off from chain reads, never from clicks alone.
 *
 * Covenants are BNB-denominated end to end (raise, treasury, redemption), so nothing here offers USDC on testnet.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Address, Hash } from "viem";
import { useWallet } from "@/components/providers";
import { TESTNET_FAUCET, explorerAddress, explorerTx } from "@/lib/chain/chains";
import { useCovenants, useSource } from "@/lib/data/hooks";
import { FaucetRefusal, requestFunds, useFaucetStatus, useNativeBalance, type PublicFaucet } from "@/lib/data/faucet";
import { short } from "@/lib/format";
import { BnbCoin } from "./bnb";
import { Icon } from "./icons";
import { ThinkingMark } from "./mark";
import { Addr, Skeleton, Ticker, TokenAvatar, cx } from "./ui";

/** Below this a wallet cannot pay for a commitment's gas and a little value: the guide opens. */
const NO_GAS = 0.001;
const tbnb = (n: number, d = 4) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: n > 0 && n < 1 ? Math.min(3, d) : 0 });

const FALLBACK_FAUCETS: PublicFaucet[] = [{ name: "BNB Chain faucet", url: TESTNET_FAUCET }];

type Drip = { state: "idle" } | { state: "busy" } | { state: "sent"; hash: Hash; amount: string } | { state: "refused"; message: string; faucets: PublicFaucet[]; retryAt: number | null };

/** One drip request for the connected wallet, with the balance and status refreshed after it lands. */
function useDrip() {
  const wallet = useWallet();
  const qc = useQueryClient();
  const [drip, setDrip] = useState<Drip>({ state: "idle" });
  async function send() {
    if (!wallet.address) { wallet.connect(); return; }
    setDrip({ state: "busy" });
    try {
      const r = await requestFunds(wallet.address as Address);
      setDrip({ state: "sent", hash: r.bnbTx, amount: (Number(r.bnbWei) / 1e18).toString() });
    } catch (e) {
      const f = e instanceof FaucetRefusal ? e : null;
      setDrip({ state: "refused", message: (e as Error).message, faucets: f?.publicFaucets.length ? f.publicFaucets : FALLBACK_FAUCETS, retryAt: f?.retryAt ?? null });
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["native-balance"] }),
        qc.invalidateQueries({ queryKey: ["faucet-status"] }),
        qc.invalidateQueries({ queryKey: ["covenants"] }),
      ]);
    }
  }
  return { drip, send, reset: () => setDrip({ state: "idle" }) };
}

function Faucets({ list, compact }: { list: PublicFaucet[]; compact?: boolean }) {
  return (
    <ul className={cx("faucet-links", compact && "compact")}>
      {list.map((f) => (
        <li key={f.url}><a href={f.url} target="_blank" rel="noreferrer">{f.name}<Icon name="arrowUpRight" size={13} /></a></li>
      ))}
    </ul>
  );
}

function DripResult({ drip }: { drip: Drip }) {
  if (drip.state === "sent") {
    const href = explorerTx(97, drip.hash);
    return (
      <div className="drip-ok" role="status">
        <Icon name="check" size={16} />
        <span>{drip.amount} tBNB sent. {href ? <a className="mono" href={href} target="_blank" rel="noreferrer">{short(drip.hash, 10, 6)}<Icon name="arrowUpRight" size={12} /></a> : <span className="mono">{short(drip.hash, 10, 6)}</span>}</span>
      </div>
    );
  }
  if (drip.state === "refused") {
    return (
      <div className="drip-no" role="alert">
        <p>{drip.message}</p>
        <Faucets list={drip.faucets} compact />
      </div>
    );
  }
  return null;
}

/* ---------- Settings: Test funds on chain 97 ---------- */

export function TestnetFunds() {
  const wallet = useWallet();
  const status = useFaucetStatus(wallet.address as Address | undefined);
  const bal = useNativeBalance();
  const { drip, send } = useDrip();
  const t = status.data?.testnet ?? null;
  const has = bal.data ?? 0;
  const enough = t ? has >= Number(t.enough) : false;
  const eligible = t?.eligible;
  const off = status.isError ? "The Covenant server did not answer, so the drip is unavailable right now." : status.data && !status.data.enabled ? status.data.reason : null;
  const blocked = !wallet.address ? null : enough ? `This wallet holds ${tbnb(has)} tBNB, enough for gas and a first commitment.` : eligible && !eligible.ok ? eligible.reason : null;
  const publicFaucets = status.data?.publicFaucets?.length ? status.data.publicFaucets : FALLBACK_FAUCETS;

  return (
    <div className="set-grid">
      <section className="drip rise" aria-labelledby="drip-title">
        <div className="drip-top">
          <div className="row between wrap-ok" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 12 }}>
              {wallet.address ? <TokenAvatar seed={wallet.address} size={36} /> : <span className="icon-tile"><Icon name="wallet" size={17} /></span>}
              <div style={{ display: "grid", minWidth: 0 }}>
                <span id="drip-title" className="h-card">Your wallet</span>
                {wallet.address ? <Addr a={wallet.address} chainId={97} /> : <span className="t-xs muted w5">Not connected</span>}
              </div>
            </div>
            <span className="drip-net">BNB testnet</span>
          </div>
          <div className="drip-bal">
            <span className="lbl">Balance</span>
            <span className="drip-fig">
              {!wallet.address ? <span className="faint">–</span> : bal.isLoading ? <Skeleton h={40} w={140} /> : <><Ticker value={has} format={(n) => tbnb(n)} /><span className="u">tBNB</span></>}
            </span>
          </div>
        </div>

        <div className="drip-body">
          <div className="drip-get">
            <BnbCoin size={40} />
            <div style={{ minWidth: 0 }}>
              <b className="num">{t?.drip ?? "0.003"} tBNB</b>
              <span>Gas for a few hundred transactions at testnet prices, plus room for a small first commitment.</span>
            </div>
          </div>
          {drip.state === "sent" ? null : off ? <p className="drip-note warn">{off}</p> : blocked ? <p className="drip-note">{blocked}</p> : null}
          {drip.state === "sent" ? null : <button
            className="btn btn-primary btn-xl btn-block"
            disabled={drip.state === "busy" || drip.state === "refused" || (Boolean(wallet.address) && (Boolean(off) || Boolean(blocked) || !status.data))}
            onClick={() => void send()}
          >
            {drip.state === "busy" ? <><ThinkingMark size={16} />Sending on BNB testnet…</>
              : !wallet.address ? <><Icon name="wallet" size={16} />Connect to get test BNB</>
              : <><Icon name="drop" size={16} />Send me {t?.drip ?? "0.003"} tBNB</>}
          </button>}
          <DripResult drip={drip} />
          {drip.state === "sent" || enough ? (
            <div className="drip-next">
              <span className="lbl">Next</span>
              <Link className="tlink" href="/app/covenants">Commit to a raise<Icon name="chevronRight" size={14} /></Link>
              <Link className="tlink" href="/app/portfolio">See your portfolio<Icon name="chevronRight" size={14} /></Link>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="stack" aria-label="About test funds">
        <section className="set-card">
          <h3 className="h-card">How the drip works</h3>
          <dl className="kv">
            <dt>Per wallet</dt><dd>{t?.drip ?? "0.003"} tBNB, once a day</dd>
            <dt>Per network</dt><dd>One wallet a day</dd>
            <dt>Left today</dt><dd className="num">{t ? `${tbnb(Number(t.dailyLeft))} of ${tbnb(Number(t.dailyCap))} tBNB` : "–"}</dd>
            <dt>Faucet wallet</dt><dd>{t?.faucetAddress ? <a className="mono" href={explorerAddress(97, t.faucetAddress) ?? undefined} target="_blank" rel="noreferrer">{short(t.faucetAddress)}</a> : "–"}</dd>
            <dt>Faucet balance</dt><dd className="num">{t?.faucetBalance ? `${tbnb(Number(t.faucetBalance))} tBNB` : "–"}</dd>
          </dl>
          <p className="t-xs muted w5">Test BNB has no value. Raises, treasuries and redemptions on Covenant are all in BNB, so there is no USDC to hold here.</p>
        </section>
        <section className="set-card">
          <h3 className="h-card">Need more?</h3>
          <p className="t-s muted w5">BNB Chain&apos;s public faucets pay larger amounts. Paste your address there.</p>
          <Faucets list={publicFaucets} />
        </section>
      </aside>
    </div>
  );
}

/* ---------- First run: Get started on testnet ---------- */

const subs = new Set<() => void>();
const keyOf = (a: string) => `cv-start:${a.toLowerCase()}`;
function readStart(a?: string | null): string | null {
  if (!a) return null;
  try { return localStorage.getItem(keyOf(a)); } catch { return null; }
}
function writeStart(a: string, v: "open" | "done") {
  try { localStorage.setItem(keyOf(a), v); } catch { /* this page only */ }
  subs.forEach((s) => s());
}
function useStart(a?: string | null) {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => readStart(a), () => "done");
}

/** Reopen the guide for the connected wallet (Settings, Test funds). */
export function reopenGetStarted(a: string) { writeStart(a, "open"); }

/**
 * Shown on chain 97 once a connected wallet is seen with no gas, until it finishes the three steps or closes the
 * guide. Steps tick from chain reads: a balance, a commitment or holding in any covenant.
 */
export function GetStarted() {
  const src = useSource();
  const wallet = useWallet();
  const path = usePathname();
  const bal = useNativeBalance();
  const { list } = useCovenants();
  const { drip, send } = useDrip();
  const start = useStart(wallet.address);
  const status = useFaucetStatus(src.chainId === 97 ? (wallet.address as Address | undefined) : undefined);
  const [min, setMin] = useState(false);

  const onTestnet = src.mode === "live" && src.chainId === 97;
  const has = bal.data;
  // first sight of a wallet with no gas opens the guide for it; once closed or finished it stays closed
  const firstSight = onTestnet && Boolean(wallet.address) && has !== undefined && has < NO_GAS && start === null;
  useEffect(() => { if (firstSight && wallet.address) writeStart(wallet.address, "open"); }, [firstSight, wallet.address]);
  if (!onTestnet || !wallet.address || start !== "open" || path.startsWith("/app/settings/funds")) return null;

  const gas = (has ?? 0) >= NO_GAS || drip.state === "sent";
  const positions = list.filter((v) => v.source === "live" && v.position && (v.position.committed > 0 || v.position.balance > 0));
  const committed = positions.length > 0;
  const raising = list.find((v) => v.source === "live" && v.state === "RAISING" && v.raise.deadline > v.now);
  const doneAll = gas && committed;
  // the server's answer before any click: dry, off, or this wallet or network already paid today
  const t = status.data?.testnet;
  const cannot = drip.state === "idle" && status.data ? (!status.data.enabled ? status.data.reason : t?.eligible && !t.eligible.ok ? t.eligible.reason : null) : null;
  const faucets = status.data?.publicFaucets?.length ? status.data.publicFaucets : FALLBACK_FAUCETS;
  const close = () => writeStart(wallet.address!, "done");

  return (
    <aside className={cx("start rise", min && "min")} aria-labelledby="start-title">
      <div className="start-head">
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span className="start-eb">BNB testnet · step {!gas ? 1 : !committed ? 2 : 3} of 3</span>
          <h2 id="start-title" className="h-card">{doneAll ? "You are set up" : "Get started on testnet"}</h2>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn sm" aria-label={min ? "Expand" : "Minimise"} aria-expanded={!min} onClick={() => setMin(!min)}><Icon name={min ? "up" : "down"} size={14} /></button>
          <button className="icon-btn sm" aria-label="Close the testnet guide" onClick={close}><Icon name="x" size={14} /></button>
        </div>
      </div>
      {min ? null : (
        <>
          <ol className="start-steps">
            <li data-done={gas}>
              <span className="n" aria-hidden>{gas ? <Icon name="check" size={13} strokeWidth={2.2} /> : 1}</span>
              <div>
                <b>Get test BNB for gas</b>
                {gas ? <span>{has !== undefined ? `${tbnb(has)} tBNB in your wallet` : "Sent"}</span> : <span>A small drip from Covenant&apos;s faucet, free and once a day.</span>}
                {!gas && cannot ? <div className="drip-no"><p>{cannot}</p><Faucets list={faucets} compact /></div> : null}
                {!gas && !cannot && drip.state !== "refused" ? (
                  <button className="btn btn-primary btn-sm" disabled={drip.state === "busy"} onClick={() => void send()}>
                    {drip.state === "busy" ? <><ThinkingMark size={14} />Sending…</> : <><Icon name="drop" size={14} />Send me 0.003 tBNB</>}
                  </button>
                ) : null}
                <DripResult drip={drip} />
              </div>
            </li>
            <li data-done={committed}>
              <span className="n" aria-hidden>{committed ? <Icon name="check" size={13} strokeWidth={2.2} /> : 2}</span>
              <div>
                <b>Commit to a raise</b>
                {committed ? <span>You hold a position in {positions.length} covenant{positions.length === 1 ? "" : "s"}</span>
                  : raising ? <span>{raising.terms.name} is raising now. Commit any amount; above the cap you are refunded pro rata.</span>
                  : <span>No raise is open right now. Browse covenants, or open one yourself.</span>}
                {!committed ? (
                  <div className="row wrap-ok" style={{ gap: 6 }}>
                    {raising ? <Link className={cx("btn btn-sm", gas ? "btn-primary" : "btn-secondary")} href={`/app/c/${raising.id}/raise`}>Commit to {raising.terms.symbol}<Icon name="arrow" size={14} /></Link>
                      : <><Link className="btn btn-secondary btn-sm" href="/app/covenants">Browse</Link><Link className="btn btn-secondary btn-sm" href="/app/create">Create</Link></>}
                  </div>
                ) : null}
              </div>
            </li>
            <li data-done={false}>
              <span className="n" aria-hidden>3</span>
              <div>
                <b>Watch it in your portfolio</b>
                <span>Allocation, refund and book value, read from the chain.</span>
                <Link className="tlink" href="/app/portfolio" onClick={() => { if (committed) close(); }}>Open portfolio<Icon name="chevronRight" size={14} /></Link>
              </div>
            </li>
          </ol>
        </>
      )}
    </aside>
  );
}
