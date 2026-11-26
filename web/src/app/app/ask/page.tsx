"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AskAI } from "@/components/app/ask-ai";

/** Covenant AI, full page. /app/ask?q=… sends the question straight away (the ⌘K palette links here). */
export default function AskPage() {
  return <Suspense fallback={<main className="page page-narrow" />}><Ask /></Suspense>;
}

function Ask() {
  const q = useSearchParams().get("q") ?? undefined;
  return (
    <main className="page page-narrow ask-page">
      <AskAI initial={q} />
    </main>
  );
}
