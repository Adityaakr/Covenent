"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { derive, type Derived } from "@/lib/covenant/derive";
import type { CovenantView } from "@/lib/covenant/types";
import { useCovenant } from "@/lib/data/hooks";
import { SheetHeader, SheetTabs } from "./covenant";
import { Empty, Skeleton } from "./ui";

/** Loads the covenant named in the URL and frames a page with the sheet header and tabs. */
export function CovenantPage({ children, header = true }: { children: (v: CovenantView, d: Derived) => ReactNode; header?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const { view, loading, source } = useCovenant(id);
  if (!view) {
    if (loading || source.mode === "checking") {
      return <main className="page"><Skeleton h={180} /><div className="grid3"><Skeleton h={160} /><Skeleton h={160} /><Skeleton h={160} /></div></main>;
    }
    return (
      <main className="page page-narrow">
        <Empty title="No covenant at this address">
          {source.mode === "live" ? "The local deployment does not list it." : `No chain to read: ${source.reason}.`} <Link className="ink" href="/app" style={{ textDecoration: "underline" }}>See all covenants</Link>
        </Empty>
      </main>
    );
  }
  const d = derive(view);
  return (
    <main className="page">
      {header ? <SheetHeader v={view} d={d} /> : null}
      <SheetTabs v={view} />
      {children(view, d)}
    </main>
  );
}
