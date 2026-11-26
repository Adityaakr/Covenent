"use client";

import { Contracts, EventFeed, IssuerBadge, Overview, RulesModule, StatusStrip, TermsCard, Tranches, TreasuryLedger, TrustPanel } from "@/components/app/covenant";
import { CovenantPage } from "@/components/app/covenant-page";
import type { Derived } from "@/lib/covenant/derive";
import type { CovenantView } from "@/lib/covenant/types";

export default function SheetPage() {
  return <CovenantPage variant="full">{(v, d) => <Sheet v={v} d={d} />}</CovenantPage>;
}

function Sheet({ v, d }: { v: CovenantView; d: Derived }) {
  const launched = v.state !== "RAISING" && v.state !== "FAILED";
  return (
    <>
      <section aria-label="Overview">
        <StatusStrip v={v} d={d} />
        <Overview v={v} d={d} />
      </section>

      <RulesModule v={v} d={d} />

      <div className="grid-main" style={{ columnGap: 40 }}>
        <div className="sections">
          {launched ? <Tranches v={v} /> : null}
          {launched ? <TreasuryLedger v={v} d={d} /> : null}
          <TrustPanel v={v} />
        </div>
        <div className="sections">
          <IssuerBadge v={v} />
          <EventFeed v={v} />
          <TermsCard v={v} d={d} />
          <Contracts v={v} />
        </div>
      </div>
    </>
  );
}
