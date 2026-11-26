"use client";

import Link from "next/link";
import { EventFeed, IssuerBadge, RuleCards, TermsCard, TreasuryLedger, TrustPanel } from "@/components/app/covenant";
import { CovenantPage } from "@/components/app/covenant-page";
import { PriceBookChart } from "@/components/app/chart";
import { Icon } from "@/components/app/icons";
import { Note } from "@/components/app/ui";
import { useActions } from "@/lib/data/actions";
import { DAY, duration } from "@/lib/covenant/time";
import { pct, price, signedPct } from "@/lib/format";
import { useState } from "react";
import type { Derived } from "@/lib/covenant/derive";
import type { CovenantView } from "@/lib/covenant/types";

export default function SheetPage() {
  return (
    <CovenantPage>
      {(v, d) => <Sheet v={v} d={d} />}
    </CovenantPage>
  );
}

function Sheet({ v, d }: { v: CovenantView; d: Derived }) {
  const { run } = useActions(v);
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const launched = v.state !== "RAISING" && v.state !== "FAILED";
  const from = range === "all" ? 0 : v.now - (range === "7d" ? 7 : 30) * DAY;
  const pts = v.history.filter((p) => p.t >= from);

  if (!launched) {
    return (
      <div className="grid-main">
        <div className="stack">
          <Note tone="accent" icon="info">
            {v.state === "RAISING"
              ? <>This covenant is still raising. The five rules arm at launch. <Link href={`/app/c/${v.id}/raise`} className="ink" style={{ textDecoration: "underline" }}>See the raise</Link>.</>
              : <>The raise missed its minimum, so nothing launched and every commitment refunds in full. <Link href={`/app/c/${v.id}/settle`} className="ink" style={{ textDecoration: "underline" }}>Claim a refund</Link>.</>}
          </Note>
          <RuleCards v={v} d={d} />
          <TermsCard v={v} d={d} />
        </div>
        <div className="stack">
          <IssuerBadge v={v} />
          <EventFeed v={v} />
        </div>
      </div>
    );
  }

  return (
    <>
      <RuleCards v={v} d={d} />
      <div className="grid-main">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h3 className="d4">Price against book</h3>
                <p className="tiny muted" style={{ margin: "2px 0 0" }}>
                  72-hour TWAP <span className="mono ink">{d.twap72 ? price(d.twap72.price) : "–"}</span> against book <span className="mono ink">{d.twap72 ? price(d.twap72.book) : "–"}</span>
                  {d.twap72 ? <span className={`mono ${d.twap72.price < d.twap72.book ? "down" : "up"}`}> ({signedPct(d.twap72.price / d.twap72.book - 1)})</span> : null}
                </p>
              </div>
              <div className="seg" role="group" aria-label="Range">
                {(["7d", "30d", "all"] as const).map((r) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r === "all" ? "All" : r}</button>)}
              </div>
            </div>
            <div style={{ padding: "12px 8px 0" }}>
              <PriceBookChart points={pts} bands={v.bands} salePrice={d.salePrice} now={v.now} />
            </div>
          </div>
          <div className="card card-pad row wrap between" style={{ gap: 12 }}>
            <div style={{ minWidth: 0, flex: "1 1 320px" }}>
              <div className="d4">{v.state === "EXIT_ROUND" ? "The exit round is open" : v.state === "WIND_DOWN" ? "The treasury is open to holders" : d.hbLeft <= 0 ? `The ${v.issuer.kind === "agent" ? "agent" : "team"} has stopped` : "Keep the rules live"}</div>
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                {v.state === "EXIT_ROUND" ? `Any holder can burn tokens for ${price(d.book)} BNB each, less the ${pct(v.terms.exitFeeBps / 10_000, 0)} fee. Ends in ${duration(v.exit.roundEndsAt! - v.now)}.`
                  : v.state === "WIND_DOWN" ? "Redemption at book with no fee and no deadline."
                  : d.hbLeft <= 0 ? `No heartbeat for ${duration(v.now - v.lastHeartbeat)}. Anyone can flip the switch: the tap stops, locked team tokens burn and the treasury opens to holders with no fee.`
                  : "Anyone can poke: it records the pool's time-weighted price and steps every counter. A keeper pokes hourly; this button keeps the covenant live without it."}
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {d.hbLeft <= 0 && v.state !== "WIND_DOWN" ? <button className="btn btn-danger" onClick={() => void run("declareAbandoned")}><Icon name="heart" size={16} />Declare abandoned</button> : null}
              <button className="btn btn-ghost" onClick={() => void run("poke")}><Icon name="pulse" size={16} />Poke</button>
              {v.state === "EXIT_ROUND" || v.state === "WIND_DOWN" ? <Link className="btn btn-accent" href={`/app/c/${v.id}/redeem`}>Redeem</Link> : null}
            </div>
          </div>
          <TreasuryLedger v={v} d={d} />
          <TrustPanel v={v} />
        </div>
        <div className="stack">
          <IssuerBadge v={v} />
          <EventFeed v={v} />
          <TermsCard v={v} d={d} />
        </div>
      </div>
    </>
  );
}
