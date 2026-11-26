"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkline } from "@/components/app/chart";
import { IssuerChip, TokenMark } from "@/components/app/covenant";
import { LiteList } from "@/components/app/lite";
import { Icon } from "@/components/app/icons";
import { Skeleton, StateBadge } from "@/components/app/ui";
import { derive } from "@/lib/covenant/derive";
import { duration } from "@/lib/covenant/time";
import { useCovenants } from "@/lib/data/hooks";
import { bnb, pct, price, signedPct } from "@/lib/format";

export default function CovenantsPage() {
  const { list, source, loading } = useCovenants();
  const router = useRouter();
  const launched = list.filter((v) => v.state !== "RAISING" && v.state !== "FAILED");
  const held = launched.reduce((a, v) => a + v.treasury, 0);
  const under = launched.filter((v) => derive(v).prem < 0).length;
  const agents = list.filter((v) => v.issuer.kind === "agent").length;

  return (
    <main className="page">
      <section className="sky">
        <div className="sky-inner" style={{ display: "grid", gap: 22 }}>
          <div style={{ display: "grid", gap: 12, maxWidth: 760 }}>
            <span className="pill-new" style={{ justifySelf: "start" }}><b>New</b>Agents can raise a budget they are held to</span>
            <h1 className="d1">Every covenant, <span className="soft">and whether its rules are holding.</span></h1>
            <p className="lede">Treasury, book value and the five rules for each raise, read from the vault. Numbers before adjectives: no score, no badge.</p>
          </div>
          <div className="stats glass" style={{ ["--n" as string]: 4 }}>
            <div className="stat"><p className="k">BNB under covenant</p><div className="v">{bnb(held)}</div><div className="s">Held by {launched.length} vaults</div></div>
            <div className="stat"><p className="k">Trading under book</p><div className="v">{under}</div><div className="s">Exit streak counting</div></div>
            <div className="stat"><p className="k">Raising now</p><div className="v">{list.filter((v) => v.state === "RAISING").length}</div><div className="s">Commitments open</div></div>
            <div className="stat"><p className="k">Agent issuers</p><div className="v">{agents}</div><div className="s">With an ERC-8004 identity</div></div>
          </div>
        </div>
      </section>

      <div className="row wrap between">
        <h2 className="d3">Covenants <span className="faint mono" style={{ fontSize: 15 }}>{list.length}</span></h2>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn btn-ghost btn-sm" href="/app/simulator"><Icon name="flask" size={15} />Simulator</Link>
          <Link className="btn btn-primary btn-sm" href="/app/create"><Icon name="plus" size={15} />Create a covenant</Link>
        </div>
      </div>

      {loading ? <Skeleton h={320} /> : list.length === 0 ? (
        <div className="card card-pad small muted">{source.mode === "live" ? "The local deployment lists no covenant yet." : `No chain to read: ${source.reason}.`} Start the stack with <span className="mono">scripts/dev-all.sh</span>; it deploys the contracts and seeds covenants at every stage with real transactions.</div>
      ) : (
        <>
        <div className="only-narrow" style={{ gap: 12 }}>
          {list.map((v) => {
            const d = derive(v);
            const live = v.state !== "RAISING" && v.state !== "FAILED";
            return (
              <Link key={v.id} href={`/app/c/${v.id}`} className="card cov-card">
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <span className="row" style={{ gap: 10 }}>
                    <TokenMark symbol={v.terms.symbol} size={36} />
                    <span style={{ display: "grid", gap: 4 }}><span className="ink" style={{ fontWeight: 550 }}>{v.terms.name} <span className="mono muted tiny">${v.terms.symbol}</span></span><IssuerChip v={v} /></span>
                  </span>
                  <StateBadge state={v.state} />
                </div>
                <div className="figs">
                  <div><div className="k">{live ? "Treasury" : "Committed"}</div><div className="v">{bnb(live ? v.treasury : v.raise.committed)}</div></div>
                  <div><div className="k">Book / token</div><div className="v">{live ? price(d.book) : "–"}</div></div>
                  <div><div className="k">vs book</div><div className={`v ${d.prem < 0 ? "down" : "up"}`}>{live ? signedPct(d.prem) : "–"}</div></div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="card table-wrap only-wide">
          <table className="table">
            <thead>
              <tr>
                <th>Covenant</th><th>State</th><th className="r">Treasury</th><th className="r">Book / token</th><th className="r">Pool price</th><th className="r">vs book</th><th>Next event</th><th>90 days</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => {
                const d = derive(v);
                const live = v.state !== "RAISING" && v.state !== "FAILED";
                const next = v.state === "RAISING" ? `Closes in ${duration(v.raise.deadline - v.now)} · ${pct(v.raise.committed / v.terms.cap, 0)} of cap`
                  : v.state === "FAILED" ? "Refunds open"
                  : v.state === "EXIT_ROUND" ? `Round ends in ${duration(v.exit.roundEndsAt! - v.now)}`
                  : v.state === "WIND_DOWN" ? "Redemption open, no fee"
                  : d.eta !== null ? `Exit opens in ${duration(d.eta)}` : `Heartbeat due in ${duration(d.hbLeft)}`;
                return (
                  <tr key={v.id} className="link" onClick={() => router.push(`/app/c/${v.id}`)}>
                    <td>
                      <Link href={`/app/c/${v.id}`} className="row" style={{ gap: 10 }}>
                        <TokenMark symbol={v.terms.symbol} size={32} />
                        <span style={{ display: "grid" }}>
                          <span className="ink" style={{ fontWeight: 550 }}>{v.terms.name} <span className="mono muted tiny">${v.terms.symbol}</span></span>
                          <span style={{ transform: "scale(0.92)", transformOrigin: "left" }}><IssuerChip v={v} /></span>
                        </span>
                      </Link>
                    </td>
                    <td><StateBadge state={v.state} /></td>
                    <td className="r mono">{live ? `${bnb(v.treasury)}` : `${bnb(v.raise.committed)}`}<span className="tiny muted"> {live ? "BNB" : "committed"}</span></td>
                    <td className="r mono">{live ? price(d.book) : "–"}</td>
                    <td className="r mono">{live ? price(v.poolPrice) : "–"}</td>
                    <td className={`r mono ${d.prem < 0 ? "down" : "up"}`}>{live ? signedPct(d.prem) : "–"}</td>
                    <td className="small muted" style={{ whiteSpace: "nowrap" }}>{next}</td>
                    <td><Sparkline points={v.history.filter((p) => p.t > v.now - 90 * 86400)} width={110} height={28} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
      <LiteList />
    </main>
  );
}
