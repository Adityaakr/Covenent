"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { Sparkline } from "@/components/app/chart";
import { CovenantCard, IssuerChip, nextEvent } from "@/components/app/covenant";
import { Icon } from "@/components/app/icons";
import { ConnectChain } from "@/components/app/live";
import { Empty, Segmented, Skeleton, StateBadge, TokenAvatar, cx, seedOf } from "@/components/app/ui";
import { derive } from "@/lib/covenant/derive";
import { DAY } from "@/lib/covenant/time";
import type { CovenantState } from "@/lib/covenant/types";
import { useCovenants } from "@/lib/data/hooks";
import { bnb, price, signedPct } from "@/lib/format";
import { BnbCoin } from "@/components/app/bnb";

type Filter = "all" | "raising" | "active" | "exit" | "closed";
const MATCH: Record<Filter, (s: CovenantState) => boolean> = {
  all: () => true,
  raising: (s) => s === "RAISING",
  active: (s) => s === "ACTIVE" || s === "COOLDOWN",
  exit: (s) => s === "EXIT_ROUND",
  closed: (s) => s === "WIND_DOWN" || s === "FAILED",
};

export default function CovenantsPage() {
  const { list: all, source, loading: reading, error } = useCovenants();
  const online = source.mode === "live";
  const list = online ? all.filter((v) => v.source === "live") : [];
  const loading = source.mode === "checking" || (online && reading);
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const shown = list.filter((v) => MATCH[filter](v.state) && (!q || `${v.terms.name} ${v.terms.symbol}`.toLowerCase().includes(q.toLowerCase())));
  const count = (f: Filter) => list.filter((v) => MATCH[f](v.state)).length;

  return (
    <main className="page">
      <div className="sec-head">
        <div className="stack-sm" style={{ display: "grid" }}>
          <h1 className="h-page">Covenants</h1>
          <p className="lede">Every raise and vault, with its treasury, book value per token and the next thing its rules will do.</p>
        </div>
        <Link className="btn btn-primary" href="/app/create"><Icon name="plus" size={15} />Create a covenant</Link>
      </div>

      <div className="fbar">
        <Segmented label="Filter by state" value={filter} onChange={setFilter} options={[
          { value: "all", label: `All ${count("all")}` }, { value: "raising", label: `Raising ${count("raising")}` }, { value: "active", label: `Active ${count("active")}` },
          { value: "exit", label: `Exit round ${count("exit")}` }, { value: "closed", label: `Closed ${count("closed")}` },
        ]} />
        <label className="search-field"><Icon name="search" size={15} /><input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ticker" aria-label="Search covenants" /></label>
      </div>

      {error ? <p className="t-s down w5">Reading the chain failed: {error}</p> : null}
      {loading ? <Skeleton h={360} r={18} /> : !online ? <ConnectChain source={source} /> : shown.length === 0 ? (
        <div className="card"><Empty title={list.length ? "No covenant matches" : "No covenants yet"} icon="layers" action={list.length ? <button className="btn btn-secondary btn-sm" onClick={() => { setFilter("all"); setQ(""); }}>Clear filters</button> : <Link className="btn btn-primary btn-sm" href="/app/create">Launch your autonomous venture</Link>}>{list.length ? "Try another state or search." : source.reason}</Empty></div>
      ) : (
        <>
          <div className="cgrid only-narrow">{shown.map((v, i) => <CovenantCard key={v.id} v={v} i={i} />)}</div>
          <div className="card table-wrap only-wide">
            <table className="table">
              <thead>
                <tr><th>Covenant</th><th>State</th><th className="r">Treasury</th><th className="r">Book / token</th><th className="r">Pool price</th><th className="r">vs book</th><th>Next</th><th className="r">30 days</th></tr>
              </thead>
              <tbody>
                {shown.map((v, i) => {
                  const d = derive(v);
                  const live = v.state !== "RAISING" && v.state !== "FAILED";
                  const nx = nextEvent(v, d);
                  return (
                    <tr key={v.id} className="click rise" style={{ ["--i" as string]: i } as CSSProperties} onClick={() => router.push(`/app/c/${v.id}`)}>
                      <td>
                        <Link href={`/app/c/${v.id}`} className="row" style={{ gap: 12 }} onClick={(e) => e.stopPropagation()}>
                          <TokenAvatar seed={seedOf(v)} size={36} issuer={v.issuer.kind} />
                          <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                            <span className="ink">{v.terms.name} <span className="mono t-xs muted">${v.terms.symbol}</span></span>
                            <IssuerChip v={v} />
                          </span>
                        </Link>
                      </td>
                      <td><StateBadge state={v.state} /></td>
                      <td className="r ink">{live ? bnb(v.treasury) : bnb(v.raise.committed)} <BnbCoin size="0.95em" title={live ? "BNB in the vault" : "BNB committed"} /></td>
                      <td className="r mono">{live ? price(d.book) : "–"}</td>
                      <td className="r mono">{live ? price(v.poolPrice) : "–"}</td>
                      <td className={cx("r", live && (d.prem < 0 ? "down" : "up"))}>{live ? signedPct(d.prem) : "–"}</td>
                      <td className={cx("t-s", nx.tone === "warn" ? "warn-t" : nx.tone === "bad" ? "down" : nx.tone === "accent" ? "accent" : "muted")} style={{ whiteSpace: "nowrap" }}>{nx.text}</td>
                      <td className="r"><span style={{ display: "inline-block" }}><Sparkline points={v.history.filter((p) => p.t > v.now - 30 * DAY)} width={96} height={26} /></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
