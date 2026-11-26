"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { chainName } from "@/lib/chain/chains";
import { derive, type Derived } from "@/lib/covenant/derive";
import type { CovenantView } from "@/lib/covenant/types";
import { useCovenant, useSource } from "@/lib/data/hooks";
import { ConnectChain } from "./live";
import { CompactHeader, CovenantHero, CovenantTabs } from "./covenant";
import { Empty, Note, Skeleton } from "./ui";
import { ThinkingMark } from "./mark";

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
  // A covenant created a moment ago may not be listed yet (the factory list is cached for a few seconds and a public
  // RPC can lag a block or two): keep rediscovering for a while before saying it is not there.
  const qc = useQueryClient();
  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(id ?? "");
  const [since] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const missing = source.mode === "live" && !loading && !view;
  const searching = missing && isAddress && now - since < SEARCH_MS;
  useEffect(() => {
    if (!missing || !isAddress) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - since < SEARCH_MS) { void qc.invalidateQueries({ queryKey: ["source"] }); void qc.invalidateQueries({ queryKey: ["covenants"] }); }
    }, 3_000);
    return () => clearInterval(t);
  }, [missing, isAddress, since, qc]);
  if (source.mode === "checking" || (source.mode === "live" && loading && !view)) return <CovenantSkeleton full={variant === "full"} />;
  if (source.mode !== "live") return <main className="page"><ConnectChain source={source} /></main>;
  if (searching) {
    return (
      <main className="page page-narrow">
        <div className="card">
          <Empty title="Looking for this covenant" icon="search">
            <span className="row" style={{ gap: 8, justifyContent: "center" }}><ThinkingMark size={16} />A raise created a moment ago can take a few seconds to appear on {chainName(source.chainId ?? 97)}. This page checks again every few seconds.</span>
          </Empty>
        </div>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="page page-narrow">
        <div className="card">
          <Empty title={`We could not find a Covenant raise at this address on ${chainName(source.chainId ?? 97)}`} icon="search"
            action={<div className="row" style={{ gap: 8, justifyContent: "center" }}><Link className="btn btn-primary btn-sm" href="/app/covenants">See all covenants</Link><Link className="btn btn-secondary btn-sm" href="/app/create">Create one</Link></div>}>
            {isAddress ? <>Check the address in the link: it should be a covenant&apos;s launcher or vault. If you just created it, refresh in a moment.</> : <>The link does not hold an address.</>} You can also browse every covenant that exists.
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

const SEARCH_MS = 60_000;

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
        <p className="loading-line"><ThinkingMark size={16} />Reading the vault…</p>
      </div>
    </main>
  );
}
