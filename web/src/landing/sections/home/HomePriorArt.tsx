"use client";
import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { SourceLink } from "../../components/SourceLink";
import { LogoMark } from "../../components/LogoMark";
import { bnb } from "../../components/Bnb";
import type { Source } from "../../content/problem";
import s from "./HomePriorArt.module.css";

/* "Why we built it": a founder note that is read, not skimmed (each word settles from faint to full as it scrolls
   through), then the approaches we learned from as a lineage: four cards, each dropping what we took from it into one
   Covenant vault. Hover or focus a card to light its path. Claims are sourced in docs/landing/sources.md ("Prior art"). */
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

/* The founder note. The first paragraph is the question, in Text Primary; the rest in Text Secondary. */
const letter: { text: string; strong?: boolean }[] = [
  {
    text: "We started with the question every buyer asks: what happens to my money after launch? Today the honest answer is nothing you can enforce.",
    strong: true,
  },
  {
    text: "None of the pieces are new. Vitalik sketched the DAICO in 2018. MetaDAO proved buyers want a treasury they can get back. Launchpads made launching easy. We took what each got right and wrote the rest into one vault.",
  },
  {
    text: "Covenant is smaller on purpose: no votes, no company, five fixed rules. That is also its limit. Holders get a contract right to treasury BNB, not the company or its IP, and there is no holder vote in v1.",
  },
];

/* Template spring for entrances: duration 0.6, bounce 0. */
const spring = { type: "spring", duration: 0.6, bounce: 0 } as const;
const FAINT = 0.16;

function Check() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12.75 9.75 18 19.5 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Gap() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

/** One word of the note: its opacity follows the note's scroll progress across its own slice. */
function Word({ progress, from, to, children }: { progress: MotionValue<number>; from: number; to: number; children: string }) {
  const opacity = useTransform(progress, [from, to], [FAINT, 1]);
  return <motion.span style={{ opacity }}>{bnb(children)}</motion.span>;
}

/** The founder note, read in place: words settle from faint to full as the note scrolls from the lower part of the
 *  screen to its middle. Reduced motion shows it at full strength. */
function Letter() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "end 0.55"] });
  const words = letter.map((p) => p.text.split(" "));
  const total = words.reduce((n, w) => n + w.length, 0);
  let k = 0;
  return (
    <div ref={ref} className={s.letterBody}>
      {letter.map((p, pi) => (
        <p key={pi} className={["t-lead", s.para, p.strong ? "c-text" : ""].join(" ")}>
          {reduce
            ? bnb(p.text)
            : words[pi].map((w, wi) => {
                const i = k++;
                return (
                  <span key={wi}>
                    <Word progress={scrollYProgress} from={i / total} to={Math.min(1, (i + 3) / total)}>
                      {w}
                    </Word>
                    {wi < words[pi].length - 1 ? " " : null}
                  </span>
                );
              })}
        </p>
      ))}
      <div className={s.sign}>
        <LogoMark className={s.signMark} />
        <p className="t-label">The Covenant team</p>
      </div>
    </div>
  );
}

/** The drop from a card into the vault: a hairline drawn in once, then a moving dash while its card is active. */
function Drop({ i, on, reduce }: { i: number; on: boolean; reduce: boolean | null }) {
  return (
    <div className={[s.drop, on ? s.dropOn : ""].join(" ")} aria-hidden="true">
      <svg className={s.dropSvg} viewBox="0 0 12 64" preserveAspectRatio="none">
        <motion.path
          d="M6 0V58"
          className={s.dropLine}
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 1 }}
          transition={{ duration: 0.7, delay: 0.25 + i * 0.1, ease: [0.44, 0, 0.56, 1] }}
        />
        {on && !reduce ? <path d="M6 0V58" className={s.dropFlow} /> : null}
      </svg>
      <span className={s.dropHead} />
    </div>
  );
}

export function HomePriorArt() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const enter = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 }, transition: { ...spring, delay: i * 0.08 } });

  return (
    <Section name="Prior art" id="prior-art">
      <div className={s.headingGroup}>
        <Eyebrow>Why we built it</Eyebrow>
        <SplitHeading className={s.heading} first="We didn’t invent the idea." second="We made it hold without a vote." stack />
      </div>

      <div className={s.letter}>
        <div className={s.letterMeta}>
          <p className="t-label c-text-2">A note from the team</p>
        </div>
        <Letter />
      </div>

      <div className={s.lineage}>
        <div className={s.lineageHead}>
          <p className="t-label">What we learned from</p>
          <p className={["t-small c-text-2", s.legend].join(" ")}>
            <span className={s.legendItem}>
              <span className={[s.chip, s.chipOk].join(" ")}><Check /></span> Gets right
            </span>
            <span className={s.legendItem}>
              <span className={[s.chip, s.chipGap].join(" ")}><Gap /></span> Leaves holders
            </span>
            <span className={s.legendItem}>
              <span className={s.legendTook} /> What we took
            </span>
          </p>
        </div>

        <div className={s.grid} onMouseLeave={() => setActive(null)}>
          <div className={s.cardsFrame} aria-hidden="true" />
          <div className={s.vault} aria-hidden="true" />
          {approaches.map((a, i) => {
            const on = active === i;
            return (
              <div key={a.name} className={[s.pair, i === 0 ? s.first : "", i === approaches.length - 1 ? s.last : ""].join(" ")} style={{ ["--col" as string]: i + 1 }}>
                <motion.article
                  className={[s.card, on ? s.cardOn : ""].join(" ")}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setActive(null);
                  }}
                  {...enter(i)}
                >
                  <header className={s.cardHead}>
                    <span className={["t-small", s.index].join(" ")}>{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="t-h4">{a.name}</h3>
                    <p className="t-small c-text-2">{a.when}</p>
                  </header>
                  <dl className={s.rows}>
                    <div className={s.row}>
                      <dt className={["t-small c-text-2", s.rowLabel].join(" ")}>
                        <span className={[s.chip, s.chipOk].join(" ")}><Check /></span>
                        Gets right
                      </dt>
                      <dd className="t-body c-text">{a.right}</dd>
                    </div>
                    <div className={s.row}>
                      <dt className={["t-small c-text-2", s.rowLabel].join(" ")}>
                        <span className={[s.chip, s.chipGap].join(" ")}><Gap /></span>
                        Leaves holders
                      </dt>
                      <dd className="t-body">{a.leaves}</dd>
                    </div>
                  </dl>
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
                </motion.article>
                <Drop i={i} on={on} reduce={reduce} />
                <motion.div className={[s.took, on ? s.tookOn : ""].join(" ")} onMouseEnter={() => setActive(i)} {...enter(i + 3)}>
                  <p className="t-small c-accent">What we took</p>
                  <p className="t-body c-text">{a.answer}</p>
                </motion.div>
              </div>
            );
          })}
          <motion.div className={s.vaultFoot} {...enter(6)}>
            <span className={s.vaultName}>
              <LogoMark />
              <span className="t-h4">Covenant</span>
            </span>
            <p className="t-body">What each got right, written into one vault. No votes, no company, five fixed rules.</p>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
