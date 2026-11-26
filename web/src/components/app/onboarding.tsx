"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import { TokenAvatar } from "./ui";
import { saveIntents, skipOnboarding, useIntents, type Intent } from "./prefs";

const OPTIONS: { id: Intent; icon: IconName; title: string; line: string }[] = [
  { id: "invest", icon: "coins", title: "Invest in a covenant", line: "Commit to raises with pro-rata refunds and a floor" },
  { id: "raise", icon: "rocket", title: "Raise for my project", line: "Write terms, launch on Flap, keep the treasury honest" },
  { id: "agent", icon: "agent", title: "Run an agent issuer", line: "Give an ERC-8004 agent a budget it is held to" },
  { id: "watch", icon: "activity", title: "Watch the market", line: "Book value, exit streaks and open rounds across vaults" },
];

/** First-run intent picker: pick what you came to do, and Discover is built from it. Skippable, reopenable from ⌘K. */
export function IntentPicker({ seeds = [] }: { seeds?: string[] }) {
  const saved = useIntents();
  const [picked, setPicked] = useState<Intent[]>(saved.length ? saved : ["invest"]);
  const toggle = (id: Intent) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") skipOnboarding(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="intent-wrap" role="dialog" aria-modal="true" aria-labelledby="intent-title">
      <div className="intent rise">
        <div className="intent-head">
          <div className="connect-bots" style={{ justifySelf: "center", marginBottom: 6 }} aria-hidden>{(seeds.length ? seeds : ["issuer-a", "keeper-b", "investor-c", "vault-d"]).slice(0, 5).map((s) => <TokenAvatar key={s} seed={s} size={36} />)}</div>
          <span className="eyebrow" style={{ justifySelf: "center" }}>The operating stack for autonomous ventures</span>
          <h2 id="intent-title">What do you want to do?</h2>
          <p className="t-s muted w5">Pick as many as you like.</p>
        </div>
        <div className="intent-grid">
          {OPTIONS.map((o, i) => (
            <button key={o.id} type="button" className="intent-opt rise" style={{ ["--i" as string]: i + 1 }} aria-pressed={picked.includes(o.id)} onClick={() => toggle(o.id)}>
              <span className="icon-tile accent"><Icon name={o.icon} size={18} /></span>
              <span className="it"><b>{o.title}</b><span>{o.line}</span></span>
              <span className="cbox" aria-hidden><Icon name="check" size={13} strokeWidth={2.2} /></span>
            </button>
          ))}
        </div>
        <div className="intent-foot">
          <span className="t-s muted w5">Your dashboard is built from this.</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={skipOnboarding}>Skip for now</button>
            <button type="button" className="btn btn-primary" disabled={picked.length === 0} onClick={() => saveIntents(picked)}>Continue<Icon name="arrow" size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
