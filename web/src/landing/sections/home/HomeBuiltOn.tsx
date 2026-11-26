"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { bnb } from "../../components/Bnb";
import s from "./HomeBuiltOn.module.css";

/* "How it's built": one covenant as a system diagram. Each integration is a node wired to the vault; picking one
   (hover, focus, click, or the slow autoplay) lights its path and shows what it does, what breaks without it and
   its real status. Facts: docs/DESIGN.md "Sponsor integrations", the contracts (src/flap, src/oracle, src/vault,
   src/openfour, src/agent) and README "Contracts". Logos: web/public/landing/logos (SOURCES.md). */

type Status = "live" | "test" | "planned";
type Part = {
  id: string;
  name: string;
  logo: string;
  /* node centre in % of the diagram box */
  x: number;
  y: number;
  flow: string;
  does: string;
  without: string;
  status: Status;
  statusText: string;
};

const parts: Part[] = [
  {
    id: "flap",
    name: "Flap Pool Launch",
    logo: "/landing/logos/flap.svg",
    x: 15,
    y: 20,
    flow: "Raise and tax in",
    does: "Our launcher and vault plug into Flap’s Pool Launch. Flap creates the token, seeds the PancakeSwap pool at the sale price, hands the reserved tokens to our vault through its Token Dock and routes trading tax to the vault.",
    without: "No raise, no launch and no tax coming into the treasury.",
    status: "live",
    statusText: "Built on it",
  },
  {
    id: "pancakeswap",
    name: "PancakeSwap",
    logo: "/landing/logos/pancakeswap.svg",
    x: 15,
    y: 80,
    flow: "Pool price",
    does: "The pool the token trades in, with its liquidity locked at launch. Its time-weighted price is the number the exit rule reads on-chain.",
    without: "Nothing to compare with book value, so no exit.",
    status: "live",
    statusText: "Built on it",
  },
  {
    id: "atlas",
    name: "Atlas",
    logo: "/landing/logos/atlas.svg",
    x: 85,
    y: 20,
    flow: "BNB/USD",
    does: "Signed BNB/USD prices for the dollar tap and the dollar unlock multiples, plus a trust gate that stops a faked pump from counting toward an unlock. The exit never needs it.",
    without: "Dollar budgets and unlocks freeze, then fall back in holders’ favour. The exit keeps working.",
    status: "test",
    statusText: "Local test signer until production keys",
  },
  {
    id: "cmc",
    name: "CoinMarketCap",
    logo: "/landing/logos/coinmarketcap.svg",
    x: 85,
    y: 50,
    flow: "Market data",
    does: "Live pair data on every covenant sheet, and real launches behind the launch simulator’s numbers.",
    without: "The sheet still reads the chain, but loses market context, and the simulator has nothing real to run on.",
    status: "live",
    statusText: "Live through our server",
  },
  {
    id: "erc8004",
    name: "ERC-8004",
    logo: "/landing/logos/erc-8004.svg",
    x: 85,
    y: 80,
    flow: "Agent identity",
    does: "An agent’s identity is bound to the team wallet when the covenant is created, and outcomes (an unlock, an abandonment, a wind-down) are written to its reputation record.",
    without: "An agent’s track record would not follow it into its next raise.",
    status: "live",
    statusText: "Built on it",
  },
  {
    id: "four",
    name: "Four.meme",
    logo: "/landing/logos/four-meme.svg",
    x: 15,
    y: 50,
    flow: "Lite template",
    does: "The Covenant Lite tax-vault template on OpenFour: a founder’s tax share goes to a vault with a tap and an abandonment switch.",
    without: "Four.meme founders would have no covenant to opt into.",
    status: "live",
    statusText: "Template built",
  },
  {
    id: "cournot",
    name: "Cournot",
    logo: "/landing/logos/cournot.svg",
    x: 50,
    y: 88,
    flow: "Report check",
    does: "A Cournot market checks each period report, and a failed check pauses the tap until a passing report lands. The vault’s verdict hook is built; the Cournot relayer is not wired yet.",
    without: "Reports are still posted on-chain, but nobody checks them.",
    status: "planned",
    statusText: "Planned",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    logo: "/landing/logos/bnb-chain.svg",
    x: 50,
    y: 11,
    flow: "Where it runs",
    does: "The launcher, the vault, the oracle and every rule are BNB Chain contracts. Agents, keepers and buyers all meet there.",
    without: "Nothing above exists without it.",
    status: "test",
    statusText: "On a local BNB Chain fork today; testnet and mainnet next",
  },
];

const STEP_MS = 4500;
const spring = { type: "spring", duration: 0.45, bounce: 0 } as const;

export function HomeBuiltOn() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.4 });

  useEffect(() => {
    if (!auto || reduce || !inView || hovered) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % parts.length), STEP_MS);
    return () => clearTimeout(t);
  }, [auto, reduce, inView, hovered, active]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };
  const p = parts[active];

  return (
    <Section name="How it is built" id="built-on" surface>
      <div className={s.headingGroup}>
        <Eyebrow>How it’s built</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="Every piece does one job."
          second="What each one does, and what breaks without it."
        />
      </div>

      <div ref={root} className={s.body} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className={s.diagram}>
          <div className={[s.frame, p.id === "bnb" ? s.frameOn : ""].join(" ")} aria-hidden="true" />
          <svg className={s.wires} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {parts
              .filter((x) => x.id !== "bnb")
              .map((x) => {
                const on = x.id === p.id;
                return (
                  <g key={x.id}>
                    <line
                      x1={x.x}
                      y1={x.y}
                      x2={50}
                      y2={50}
                      className={[s.wire, x.status === "planned" ? s.wirePlanned : "", on ? s.wireOn : ""].join(" ")}
                      vectorEffect="non-scaling-stroke"
                    />
                    {on && !reduce ? (
                      <line x1={x.x} y1={x.y} x2={50} y2={50} className={s.pulse} vectorEffect="non-scaling-stroke" />
                    ) : null}
                  </g>
                );
              })}
          </svg>

          <div className={s.vault} style={{ left: "50%", top: "50%" }}>
            <p className={s.vaultName}>Covenant vault</p>
            <p className={s.vaultSub}>five rules, one sheet</p>
          </div>

          {parts.map((x, i) => {
            const on = i === active;
            return (
              <button
                key={x.id}
                type="button"
                className={[s.node, on ? s.nodeOn : "", x.status === "planned" ? s.nodePlanned : "", x.id === "bnb" ? s.nodeChain : ""].join(" ")}
                style={{ left: `${x.x}%`, top: `${x.y}%` }}
                onClick={() => pick(i)}
                onFocus={() => pick(i)}
                onMouseEnter={() => {
                  setAuto(false);
                  setActive(i);
                }}
                aria-pressed={on}
                aria-label={x.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.logo} alt="" className={s.logo} draggable={false} />
                <span className={s.nodeName}>{x.name}</span>
              </button>
            );
          })}
          {parts.map((x) =>
            x.id === p.id && x.id !== "bnb" ? (
              <span
                key={`flow-${x.id}`}
                className={s.flow}
                style={{ left: `${(x.x + 50) / 2}%`, top: `${(x.y + 50) / 2}%` }}
                aria-hidden="true"
              >
                {bnb(x.flow)}
              </span>
            ) : null,
          )}
        </div>

        <div className={s.detail} aria-live="polite">
          <motion.div
            key={p.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className={s.detailInner}
          >
            <div className={s.detailHead}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt="" className={s.detailLogo} />
              <h3 className="t-h4">{p.name}</h3>
              <span className={[s.status, s[`status_${p.status}`]].join(" ")}>
                <span className={s.statusDot} />
                {p.statusText}
              </span>
            </div>
            <div className={s.block}>
              <p className="t-small c-accent">What it does in Covenant</p>
              <p className="t-body c-text">{bnb(p.does)}</p>
            </div>
            <div className={s.block}>
              <p className="t-small c-text-2">Without it</p>
              <p className="t-body">{bnb(p.without)}</p>
            </div>
          </motion.div>
          <div className={s.dots} role="tablist" aria-label="Integrations">
            {parts.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={x.name}
                className={[s.dot, i === active ? s.dotOn : ""].join(" ")}
                onClick={() => pick(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
