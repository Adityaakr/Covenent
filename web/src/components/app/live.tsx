"use client";

/*
 * Every number in the app comes from the chain or the Covenant server. When the local deployment is not reachable
 * the screens show this state instead of placeholder values: what is missing, the one command that starts the
 * stack, and a retry.
 */
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSource, type SourceStatus } from "@/lib/data/hooks";
import { Icon } from "./icons";
import { TokenAvatar } from "./ui";
import { ThinkingMark } from "./mark";

export function useLive(): { live: boolean; checking: boolean; source: SourceStatus } {
  const source = useSource();
  return { live: source.mode === "live", checking: source.mode === "checking", source };
}

export function CopyCode({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="code">
      <span>{text}</span>
      <button type="button" aria-label={done ? "Copied" : "Copy command"} title={done ? "Copied" : "Copy"} onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}>
        <Icon name={done ? "check" : "copy"} size={13} />
      </button>
    </span>
  );
}

/** The state every live screen shows until the local chain answers. */
export function ConnectChain({ source, title = "Connect to the local chain" }: { source: SourceStatus; title?: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (source.mode === "checking") return <p className="loading-line"><ThinkingMark size={16} />Looking for the local chain…</p>;
  return (
    <section className="connect rise" aria-label={title}>
      <div className="connect-l">
        <div className="connect-bots" aria-hidden>{["vault-a", "keeper-b", "issuer-c"].map((s) => <TokenAvatar key={s} seed={s} size={40} />)}</div>
        <span className="eyebrow">Local chain · not connected</span>
        <h2 className="h-page" style={{ fontSize: 28 }}>{title}</h2>
        <p className="t-s muted w5" style={{ maxWidth: "52ch" }}>Every figure here is read from the contracts or the Covenant server, so nothing shows until they answer. <span className="ink">{source.reason}.</span></p>
        <div className="row wrap-ok" style={{ gap: 8, marginTop: 4 }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => { setBusy(true); void qc.invalidateQueries({ queryKey: ["source"] }).finally(() => setTimeout(() => setBusy(false), 600)); }}>
            {busy ? <ThinkingMark size={16} /> : <Icon name="refresh" size={15} />}Check again
          </button>
          <Link className="btn btn-secondary" href="/features"><Icon name="book" size={15} />How it works</Link>
        </div>
      </div>
      <ol className="connect-steps">
        <li className="cstep"><span className="n">1</span><div><b>Start the stack</b><span>Chain, contracts, a live covenant, the API, keeper and issuer agent.</span><br /><CopyCode text="scripts/dev-all.sh" /></div></li>
        <li className="cstep"><span className="n">2</span><div><b>The app finds the deployment</b><span>It reads contracts/deployments/local.json on every request; this page updates by itself.</span></div></li>
        <li className="cstep"><span className="n">3</span><div><b>Get test funds and connect</b><span>Mint test BNB on the local chain, then pick a wallet or a local test account.</span><br /><Link className="tlink" href="/app/faucet" style={{ marginTop: 6 }}>Get test funds<Icon name="chevronRight" size={14} /></Link></div></li>
      </ol>
    </section>
  );
}
