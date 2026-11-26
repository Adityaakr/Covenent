import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { SourceLink } from "../../components/SourceLink";
import { ScrollLift } from "../../components/ScrollLift";
import { bnb } from "../../components/Bnb";
import type { Source } from "../../content/problem";
import s from "./HomePriorArt.module.css";

/* "Why we built it": a founder note, then the approaches we learned from, side by side: what each gets right, where
   it leaves holders, and what we took from it. Claims are sourced in docs/landing/sources.md ("Prior art"). */
type Approach = { name: string; when: string; right: string; leaves: string; answer: string; sources: Source[] };

const approaches: Approach[] = [
  {
    name: "The DAICO",
    when: "Vitalik Buterin, 2018",
    right: "A tap the team can lower but not raise, and a way for holders to get their money back.",
    leaves: "Both run on a vote. The refund only happens if enough holders turn up and agree.",
    answer: "We kept the tap and the pro rata refund, and swapped the vote for a rule one holder can use.",
    sources: [{ label: "ethresear.ch", href: "https://ethresear.ch/t/explanation-of-daicos/465" }],
  },
  {
    name: "Ownership coins",
    when: "MetaDAO, 2025 to 2026",
    right: "The treasury sits under market oversight, so the team can’t easily rug it. Buyers offered $580M across 14 raises.",
    leaves: "The treasury moves only by decision market. A holder who wants out alone sells at the market price.",
    answer: "Three days below book value opens a round where any holder redeems at book. No proposal needed.",
    sources: [
      { label: "MetaDAO docs", href: "https://docs.metadao.fi/benefits/ownership-coins" },
      { label: "Basis Point", href: "https://basispointres.substack.com/p/metadao-ownership-coins" },
    ],
  },
  {
    name: "Launchpads",
    when: "Bonding curves: Pump.fun and others",
    right: "Anyone can launch a token in minutes, and trading starts at once.",
    leaves: "No treasury and no terms after launch. 98.6% of Pump.fun tokens fell below $1,000 of liquidity.",
    answer: "A covenant is a launch type inside Flap and Four.meme: the same speed, plus a vault and fixed terms.",
    sources: [
      { label: "Solidus Labs", href: "https://www.soliduslabs.com/reports/solana-rug-pulls-pump-dumps-crypto-compliance" },
    ],
  },
  {
    name: "Locks and vesting",
    when: "The usual fix",
    right: "A liquidity lock keeps the pool in place. Vesting stops insiders selling on day one.",
    leaves: "Neither says anything about the raise or the treasury. A team can vest in full into a dead token.",
    answer: "Team tokens unlock on sustained price, not dates, and the treasury pays out only through the five rules.",
    sources: [],
  },
];

function Check() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12.75 9.75 18 19.5 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Gap() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.75 12H13.5M13.5 5.25L20.25 12L13.5 18.75Z" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomePriorArt() {
  return (
    <Section name="Prior art" id="prior-art">
      <div className={s.top}>
        <div className={s.headingGroup}>
          <Eyebrow>Why we built it</Eyebrow>
          <SplitHeading className={s.heading} first="We didn’t invent the idea." second="We made it hold without a vote." />
        </div>
        <div className={s.note}>
          <p className="t-lead c-text">
            We started with the question every buyer asks: what happens to my money after launch? Today the honest answer
            is nothing you can enforce.
          </p>
          <p className="t-lead">
            None of the pieces are new. Vitalik sketched the DAICO in 2018. MetaDAO proved buyers want a treasury they can
            get back. Launchpads made launching easy. We took what each got right and wrote the rest into one vault.
          </p>
          <p className="t-lead">
            Covenant is smaller on purpose: no votes, no company, five fixed rules. That is also its limit. Holders get a
            contract right to treasury {bnb("BNB")}, not the company or its IP, and there is no holder vote in v1.
          </p>
          <p className={["t-label", s.sign].join(" ")}>The Covenant team</p>
        </div>
      </div>

      <ScrollLift className={s.grid}>
        {approaches.map((a) => (
          <article key={a.name} className={s.card}>
            <div className={s.cardHead}>
              <h3 className="t-h4">{a.name}</h3>
              <p className="t-small c-text-2">{a.when}</p>
            </div>
            <div className={s.line}>
              <span className={[s.icon, s.iconOk].join(" ")}>
                <Check />
              </span>
              <div>
                <p className="t-small c-text-2">Gets right</p>
                <p className="t-body c-text">{a.right}</p>
              </div>
            </div>
            <div className={s.line}>
              <span className={[s.icon, s.iconGap].join(" ")}>
                <Gap />
              </span>
              <div>
                <p className="t-small c-text-2">Leaves holders</p>
                <p className="t-body">{a.leaves}</p>
              </div>
            </div>
            <div className={[s.line, s.answer].join(" ")}>
              <span className={[s.icon, s.iconAccent].join(" ")}>
                <Arrow />
              </span>
              <div>
                <p className="t-small c-accent">What we took</p>
                <p className="t-body c-text">{a.answer}</p>
              </div>
            </div>
            <div className={s.sources}>
              {a.sources.length ? (
                a.sources.map((src) => (
                  <SourceLink key={src.href} href={src.href}>
                    {src.label}
                  </SourceLink>
                ))
              ) : (
                <p className="t-small c-text-2">Our own read of how these work</p>
              )}
            </div>
          </article>
        ))}
      </ScrollLift>
    </Section>
  );
}
