"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { derive, type Derived } from "@/lib/covenant/derive";
import type { CovenantView } from "@/lib/covenant/types";
import { useCovenant, useSource } from "@/lib/data/hooks";
import { ConnectChain } from "./live";
import { CompactHeader, CovenantHero, CovenantTabs } from "./covenant";
import { Icon } from "./icons";
import { Empty, Note, Skeleton } from "./ui";

/**
 * Loads the covenant named in the URL and frames a page: the full cover on the overview, a compact header on the
 * flows (raise, settlement, redeem, console), then the page tabs. Loading, missing and error states live here.
 */
export function CovenantPage({ children, variant = "compact" }: { children: (v: CovenantView, d: Derived) => ReactNode; variant?: "full" | "compact" }) {
  const { id } = useParams<{ id: string }>();
  const { view: found, loading, error } = useCovenant(id);
  const source = useSource();
  // Only chain reads are shown: a covenant that exists only in the mock layer reads as missing.
  const view = found?.source === "live" ? found : undefined;
  if (source.mode === "checking" || (source.mode === "live" && loading && !view)) return <CovenantSkeleton full={variant === "full"} />;
  if (source.mode !== "live") return <main className="page"><ConnectChain source={source} /></main>;
  if (!view) {
    return (
      <main className="page page-narrow">
        <div className="card">
          <Empty title="No covenant at this address" icon="search"
            action={<div className="row" style={{ gap: 8, justifyContent: "center" }}><Link className="btn btn-primary btn-sm" href="/app/covenants">See all covenants</Link><Link className="btn btn-secondary btn-sm" href="/app/create">Create one</Link></div>}>
            The local deployment does not list it. Covenants are the raises and vaults of autonomous ventures; check the link or browse the ones that exist.
          </Empty>
        </div>
        {error ? <Note tone="warn">Reading the chain failed: {error}</Note> : null}
      </main>
    );
  }
  const d = derive(view);
  return (
    <main>
      {variant === "full" ? <CovenantHero v={view} d={d} /> : <div className="wrap"><CompactHeader v={view} d={d} /></div>}
      <div className="wrap" style={{ marginTop: variant === "full" ? 22 : 0 }}><CovenantTabs v={view} /></div>
      {error ? <div className="wrap" style={{ marginTop: 16 }}><Note tone="warn" icon="alert">The last chain read failed ({error}); figures may be stale.</Note></div> : null}
      <div className="page">{children(view, d)}</div>
    </main>
  );
}

function CovenantSkeleton({ full }: { full: boolean }) {
  return (
    <main aria-busy="true" aria-label="Loading covenant">
      {full ? <Skeleton h={216} r={0} /> : null}
      <div className="wrap">
        <div className="row" style={{ gap: 14, padding: full ? "18px 0 0" : "26px 0 18px" }}>
          <Skeleton h={full ? 92 : 48} w={full ? 92 : 48} r={999} style={full ? { marginTop: -60, boxShadow: "0 0 0 6px var(--bg)" } : undefined} />
          <div className="stack-sm" style={{ display: "grid", flex: 1 }}><Skeleton h={26} w="40%" /><Skeleton h={14} w="62%" /></div>
        </div>
      </div>
      <div className="page">
        <Skeleton h={58} r={16} />
        <div className="grid2"><Skeleton h={300} r={18} /><Skeleton h={300} r={18} /></div>
        <div className="rules">{[0, 1, 2, 3, 4].map((k) => <Skeleton key={k} h={220} r={18} />)}</div>
        <p className="t-xs muted w5 row" style={{ gap: 6 }}><Icon name="refresh" size={13} />Reading the vault…</p>
      </div>
    </main>
  );
}
