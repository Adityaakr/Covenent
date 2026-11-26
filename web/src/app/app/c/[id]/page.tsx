"use client";

import { Contracts, EventFeed, IssuerBadge, Overview, RulesModule, StatusStrip, TermsCard, TreasuryLedger, TrustPanel } from "@/components/app/covenant";
import { CovenantPage } from "@/components/app/covenant-page";
import { AgentDecisions, AgentEconomy } from "@/components/app/agent-decisions";
import { Health, MoneyMap, RaiseClosed, Story, SupplyBar, UnlockCurve, UnlockLadder } from "@/components/app/story";
import type { Derived } from "@/lib/covenant/derive";
import type { CovenantView } from "@/lib/covenant/types";

export default function SheetPage() {
  return <CovenantPage variant="full">{(v, d) => <Sheet v={v} d={d} />}</CovenantPage>;
}

function Sheet({ v, d }: { v: CovenantView; d: Derived }) {
  const launched = v.state !== "RAISING" && v.state !== "FAILED";
  const w = v.issuer.kind === "agent" ? "agent" : "team";
  return (
    <>
      <section aria-label="Overview">
        <StatusStrip v={v} d={d} />
        <Overview v={v} d={d} />
      </section>

      <RulesModule v={v} d={d} />

      <MoneyMap v={v} d={d} />

      {launched ? (
        <Story id="raise-history" title="Raise history" sub="How the raise closed, what has unlocked since, and who holds the supply.">
          <RaiseClosed v={v} d={d} />
          <div className="story-divide" />
          <div className="story-split">
            <UnlockLadder v={v} d={d} />
            <SupplyBar v={v} />
          </div>
        </Story>
      ) : v.state === "RAISING" ? (
        <Story id="if-it-launches" title="If it launches" sub="Where the supply goes, and when the team's share can unlock.">
          <div className="story-split">
            <UnlockCurve v={v} d={d} />
            <SupplyBar v={v} />
          </div>
        </Story>
      ) : null}

      {launched ? (
        <Story id="health" title="Health" sub={`The treasury if the ${w} draws its full limit, what it holds, and the rules on spending it.`}>
          <Health v={v} d={d} />
        </Story>
      ) : null}

      <div className="grid-main" style={{ columnGap: 28 }}>
        <div className="sections">
          {launched ? <TreasuryLedger v={v} d={d} /> : null}
          <TrustPanel v={v} />
        </div>
        <div className="sections">
          <IssuerBadge v={v} />
          {v.vault ? <AgentDecisions v={v} /> : null}
          {v.issuer.kind === "agent" || v.vault ? <AgentEconomy v={v} /> : null}
          <EventFeed v={v} />
          <TermsCard v={v} d={d} />
          <Contracts v={v} />
        </div>
      </div>
    </>
  );
}
