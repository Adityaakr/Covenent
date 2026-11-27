"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { bnb } from "../../components/Bnb";
import { Address } from "../../components/Address";
import { IconArrowUpRight } from "../../components/icons";
import { integrations, statusLabel, type Integration } from "../../content/integrations";
import { HowGlyph } from "./builtOnIcons";
import s from "./HomeBuiltOn.module.css";

/* "How it's built": one covenant as a live flow. Backers' BNB goes through Flap Pool Launch into the PancakeSwap pool
   and the Covenant vault; the pool's TWAP and Atlas BNB/USD feed the oracle; the vault pays the issuer agent, whose
   ERC-8004 identity carries its outcomes; Four.meme is the Lite branch coming to mainnet; CoinMarketCap feeds the
   simulator off-chain; BNB Chain is the frame everything on-chain sits in. Picking an integration (node, step, hash
   #built-on-<id> from the hero, or the slow autoplay) lights its path and opens its card. Phones get the same cards
   as stacked steps. Facts: content/integrations.ts. Logos: web/public/landing/logos (SOURCES.md). */

const parts = integrations;
const STEP_MS = 5200;
const spring = { type: "spring", duration: 0.45, bounce: 0 } as const;

/* The canvas is 1000 x 520 user units; HTML nodes sit at the same points as percentages, so the SVG never distorts. */
const W = 1000;
const H = 520;
type Pt = { x: number; y: number };
type CoreNode = Pt & { id: string; label: string; sub?: string };

const POS: Record<string, Pt> = {
  flap: { x: 295, y: 210 },
  pancakeswap: { x: 380, y: 78 },
  atlas: { x: 840, y: 78 },
  erc8004: { x: 880, y: 330 },
  four: { x: 250, y: 330 },
  cmc: { x: 250, y: 462 },
  bnb: { x: 110, y: 400 },
};
const CORE: CoreNode[] = [
  { id: "backers", x: 56, y: 210, label: "Backers", sub: "commit BNB" },
  { id: "oracle", x: 600, y: 78, label: "CovenantOracle" },
  { id: "agent", x: 880, y: 210, label: "Issuer agent", sub: "draws the tap" },
  { id: "lite", x: 480, y: 330, label: "Covenant Lite vault", sub: "coming to mainnet" },
  { id: "sim", x: 480, y: 462, label: "Launch simulator", sub: "tests the terms" },
];
const VAULT: Pt = { x: 600, y: 210 };
const at = (id: string): Pt => (id === "vault" ? VAULT : POS[id] ?? CORE.find((c) => c.id === id)!);

type Edge = {
  id: string;
  from: string;
  to: string;
  label: string;
  on: string[];
  via?: Pt;
  /** where the label sits when the midpoint would touch a node */
  labelAt?: Pt;
  dashed?: boolean;
  offchain?: boolean;
};
const EDGES: Edge[] = [
  { id: "raise", from: "backers", to: "flap", label: "BNB raise", on: ["flap"] },
  { id: "seed", from: "flap", to: "pancakeswap", label: "seeds the pool", on: ["flap", "pancakeswap"] },
  { id: "fill", from: "flap", to: "vault", label: "treasury, tokens, tax", on: ["flap"] },
  { id: "twap", from: "pancakeswap", to: "oracle", label: "TWAP", on: ["pancakeswap"] },
  { id: "usd", from: "atlas", to: "oracle", label: "BNB/USD", on: ["atlas"] },
  { id: "obs", from: "oracle", to: "vault", label: "one observation", on: ["pancakeswap", "atlas"] },
  { id: "tap", from: "vault", to: "agent", label: "capped tap", on: ["atlas", "erc8004"], labelAt: { x: 752, y: 210 } },
  { id: "identity", from: "erc8004", to: "agent", label: "identity", on: ["erc8004"] },
  { id: "outcomes", from: "vault", to: "erc8004", label: "outcomes", on: ["erc8004"], via: { x: 600, y: 330 } },
  { id: "lite", from: "four", to: "lite", label: "tax share", on: ["four"], dashed: true },
  { id: "sim", from: "cmc", to: "sim", label: "real launches", on: ["cmc"], dashed: true, offchain: true },
];

function geometry(e: Edge) {
  const a = at(e.from);
  const b = at(e.to);
  if (e.via) {
    const c = e.via;
    return {
      d: `M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`,
      mid: { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y },
      len: Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y),
    };
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mid = { x: a.x + dx / 2, y: a.y + dy / 2 };
  const len = Math.hypot(dx, dy) * 1.1;
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return { d: `M${a.x} ${a.y} L${b.x} ${b.y}`, mid, len };
  if (Math.abs(dx) >= Math.abs(dy)) return { d: `M${a.x} ${a.y} C${mid.x} ${a.y} ${mid.x} ${b.y} ${b.x} ${b.y}`, mid, len };
  return { d: `M${a.x} ${a.y} C${a.x} ${mid.y} ${b.x} ${mid.y} ${b.x} ${b.y}`, mid, len };
}
const GEO = Object.fromEntries(
  EDGES.map((e) => {
    const g = geometry(e);
    return [e.id, e.labelAt ? { ...g, mid: e.labelAt } : g];
  }),
);
const pct = (p: Pt) => ({ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` });

/** Which edges and nodes light up for an integration. BNB Chain lights everything on-chain. */
function pathOf(id: string) {
  const edges = EDGES.filter((e) => (id === "bnb" ? !e.offchain : e.on.includes(id)));
  const nodes = new Set<string>([id]);
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
  }
  if (id === "bnb") nodes.add("bnb");
  return { edges: new Set(edges.map((e) => e.id)), nodes };
}

export function HomeBuiltOn() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [phone, setPhone] = useState(false);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.35 });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 809.98px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const playing = auto && !reduce && inView && !phone;
  useEffect(() => {
    if (!playing || hovered) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % parts.length), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, hovered, active]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  // The hero's "Built with" marks link to #built-on-<id>: open that card and bring the section into view.
  useEffect(() => {
    const open = () => {
      const m = /^#built-on-(.+)$/.exec(window.location.hash);
      const i = m ? parts.findIndex((x) => x.id === m[1]) : -1;
      if (i < 0) return;
      setAuto(false);
      setActive(i);
      document.getElementById("built-on")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [reduce]);

  const p = parts[active];
  const lit = pathOf(p.id);

  return (
    <Section name="How it is built" id="built-on" surface>
      <div className={s.headingGroup}>
        <Eyebrow>How it’s built</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="Every piece does one job."
          second="Follow the money and the data."
        />
      </div>

      <div ref={root} className={s.body} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {/* Tablet and desktop: one panel with the flow canvas, its step rail and the card of the picked integration. */}
        <div className={s.plate}>
          <div className={s.canvas} role="group" aria-label="How a covenant is built: pick an integration">
            <div className={[s.frame, p.id === "bnb" ? s.frameOn : ""].join(" ")} aria-hidden="true" />
            <span className={s.zone} style={pct({ x: 30, y: 432 })} aria-hidden="true">
              Off-chain
            </span>

            <svg className={s.wires} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              {EDGES.map((e) => {
                const on = lit.edges.has(e.id);
                const g = GEO[e.id];
                return (
                  <path
                    key={e.id}
                    d={g.d}
                    className={[s.wire, e.dashed ? s.wireDashed : "", on ? s.wireOn : ""].join(" ")}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {reduce
                ? null
                : EDGES.map((e) => {
                    const on = lit.edges.has(e.id);
                    if (!on && e.dashed) return null;
                    const g = GEO[e.id];
                    const dur = Math.max(1.4, g.len / (on ? 150 : 70));
                    const n = on ? 3 : 1;
                    return Array.from({ length: n }, (_, k) => (
                      <circle key={`${e.id}-${on ? "on" : "idle"}-${k}`} r={on ? 5 : 3.5} className={on ? s.dotOn : s.dotIdle}>
                        <animateMotion dur={`${dur}s`} begin={`${-(k * dur) / n}s`} repeatCount="indefinite" path={g.d} />
                      </circle>
                    ));
                  })}
            </svg>

            {CORE.map((c) => (
              <div
                key={c.id}
                className={[s.core, lit.nodes.has(c.id) ? s.coreOn : s.dim].join(" ")}
                style={pct(c)}
                aria-hidden="true"
              >
                <span className={s.coreLabel}>{c.label}</span>
                {c.sub ? <span className={s.coreSub}>{c.sub}</span> : null}
              </div>
            ))}

            <div className={[s.vault, lit.nodes.has("vault") || p.id === "bnb" ? "" : s.dim].join(" ")} style={pct(VAULT)} aria-hidden="true">
              <p className={s.vaultName}>Covenant vault</p>
              <p className={s.vaultSub}>five rules, one sheet</p>
            </div>

            {parts.map((x, i) => {
              const on = i === active;
              return (
                <button
                  key={x.id}
                  type="button"
                  className={[s.node, on ? s.nodeOn : "", lit.nodes.has(x.id) ? "" : s.dim, x.id === "bnb" ? s.nodeChain : ""].join(" ")}
                  style={pct(POS[x.id])}
                  onClick={() => pick(i)}
                  onFocus={() => pick(i)}
                  onMouseEnter={() => pick(i)}
                  aria-pressed={on}
                  aria-label={`${x.name}: ${x.step}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.logo} alt="" className={s.logo} draggable={false} />
                  <span className={s.nodeName}>{x.name}</span>
                </button>
              );
            })}

            {p.id === "bnb"
              ? null
              : EDGES.filter((e) => lit.edges.has(e.id)).map((e) => (
                  <motion.span
                    key={`${p.id}-${e.id}`}
                    className={s.flowLabel}
                    style={pct(GEO[e.id].mid)}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={spring}
                    aria-hidden="true"
                  >
                    {bnb(e.label, "mono")}
                  </motion.span>
                ))}
          </div>

          <div className={s.rail} role="tablist" aria-label="Integrations, in the order money and data flow">
            {parts.map((x, i) => {
              const on = i === active;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={[s.railStep, on ? s.railOn : ""].join(" ")}
                  onClick={() => pick(i)}
                >
                  <span className={s.railNum}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={s.railText}>{x.step}</span>
                  {on && playing ? (
                    <span
                      key={`bar-${active}`}
                      className={s.railBar}
                      style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: hovered ? "paused" : "running" }}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className={s.detail} aria-live="polite">
            <motion.div
              key={p.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
            >
              <IntegrationCard p={p} />
            </motion.div>
          </div>
        </div>

        {/* Phone: the same cards as stacked steps, one open at a time. */}
        <ol className={s.steps}>
          {parts.map((x, i) => {
            const on = i === active;
            return (
              <li key={x.id} className={[s.stepItem, on ? s.stepOn : ""].join(" ")}>
                <span className={s.stepRail} aria-hidden="true">
                  <span className={s.stepNum}>{i + 1}</span>
                  {i < parts.length - 1 ? <span className={s.stepLine}>{reduce ? null : <span className={s.stepPulse} />}</span> : null}
                </span>
                <div className={s.stepBody}>
                  <button type="button" className={s.stepHead} aria-expanded={on} onClick={() => pick(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.logo} alt="" className={s.stepLogo} />
                    <span className={s.stepTitle}>
                      <span className={s.stepVerb}>{x.step}</span>
                      <span className={s.stepName}>{x.name}</span>
                      <span className={s.stepChips}>
                        <StatusChip p={x} />
                        {x.next ? <span className={[s.chip, s.chip_next].join(" ")}>{x.next}</span> : null}
                      </span>
                    </span>
                    <svg className={s.stepCaret} width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {on ? (
                      <motion.div
                        key="card"
                        className={s.stepCard}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={spring}
                      >
                        <IntegrationCard p={x} compact />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}

function StatusChip({ p }: { p: Integration }) {
  return (
    <span className={[s.chip, s[`chip_${p.status}`]].join(" ")}>
      <span className={s.statusDot} />
      {statusLabel[p.status]}
    </span>
  );
}

/** One integration as a compact card: status, one line, three steps, the proof, then the addresses folded away. */
function IntegrationCard({ p, compact }: { p: Integration; compact?: boolean }) {
  const n = p.contracts.length + (p.previous?.length ?? 0);
  return (
    <article className={[s.card, compact ? s.cardCompact : ""].join(" ")}>
      {compact ? null : (
        <header className={s.cardHead}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.logo} alt="" className={s.cardLogo} />
          <h3 className={s.cardName}>{p.name}</h3>
          <span className={s.chips}>
            {p.next ? <span className={[s.chip, s.chip_next].join(" ")}>{p.next}</span> : null}
            <StatusChip p={p} />
          </span>
        </header>
      )}

      <div className={s.colA}>
        <p className={s.does}>{bnb(p.does)}</p>
        <p className={s.without}>
          <span className={s.withoutLabel}>Without it</span>
          {bnb(p.without)}
        </p>
      </div>

      <ol className={s.how}>
        {p.how.map((h, i) => (
          <li key={h.text}>
            <span className={s.howIcon}>
              <HowGlyph name={h.icon} />
              <span className={s.howNum}>{i + 1}</span>
            </span>
            <span className={s.howText}>{bnb(h.text)}</span>
          </li>
        ))}
      </ol>

      <div className={s.colC}>
        <div className={s.proof}>
          <span className={s.proofLabel}>Proof</span>
          <span className={s.proofLinks}>
            {p.proof.map((x) => (
              <a key={x.href} href={x.href} target="_blank" rel="noopener noreferrer" className={s.proofLink}>
                <span className={s.proofName}>{x.label}</span>
                <span className={s.proofValue}>{x.value}</span>
                <IconArrowUpRight size={11} />
              </a>
            ))}
          </span>
        </div>

        <p className={s.note}>{bnb(p.statusNote)}</p>

        {n ? (
          <details className={s.contracts}>
            <summary className={s.contractsSummary}>
              <span>Contracts ({n})</span>
              <svg className={s.caret} width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className={s.contractsList}>
              {p.contracts.map((a) => (
                <Address key={`${a.chain}-${a.address}`} a={a} />
              ))}
              {p.previous?.length ? (
                <>
                  <p className={s.previous}>Previous deployment</p>
                  {p.previous.map((a) => (
                    <Address key={`${a.chain}-${a.address}`} a={a} />
                  ))}
                </>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </article>
  );
}
