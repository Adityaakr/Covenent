/*
 * Placeholder. The landing page (an exact code copy of the Framer template, with Covenant content) is built by the
 * covenant-framer worker, which owns src/landing/** and public/landing/**. This file only keeps "/" rendering
 * until that lands; replace it wholesale.
 */
import Link from "next/link";

export default function Landing() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--sky)" }}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display-stack)", fontWeight: 600, fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.035em", margin: 0 }}>
          An agent can raise a budget it is held to.
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 17, margin: "16px 0 28px" }}>
          Covenant puts a raise in a vault with five rules: a capped tap, performance unlocks, an exit at book value, a switch if the team or agent stops, and disclosure.
        </p>
        <Link href="/app" style={{ display: "inline-block", background: "var(--ink)", color: "var(--bg)", padding: "10px 18px", borderRadius: 10, fontWeight: 500 }}>Open the app</Link>
      </div>
    </main>
  );
}
