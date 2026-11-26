"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { bnb } from "../../components/Bnb";
import { Address } from "../../components/Address";
import { integrations, statusLabel } from "../../content/integrations";
import s from "./HomeBuiltOn.module.css";

/* "How it's built": one covenant as a system diagram. Each integration is a node wired to the vault; picking one
   (hover, focus, click, or the slow autoplay) lights its path and shows what it does, exactly how we use it, its
   addresses and how far it is proven. Data: content/integrations.ts. Logos: web/public/landing/logos (SOURCES.md). */

const parts = integrations;

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
              <span className={[s.chip, s[`chip_${p.status}`]].join(" ")}>
                <span className={s.statusDot} />
                {statusLabel[p.status]}
              </span>
              <p className={["t-small c-text-2", s.statusText].join(" ")}>{bnb(p.statusText)}</p>
            </div>
            <div className={s.block}>
              <p className="t-small c-accent">What it does in Covenant</p>
              <p className="t-body c-text">{bnb(p.does)}</p>
            </div>
            <div className={s.block}>
              <p className="t-small c-text-2">How we use it</p>
              <ul className={s.how}>
                {p.how.map((h) => (
                  <li key={h} className="t-small">
                    {bnb(h)}
                  </li>
                ))}
              </ul>
            </div>
            {p.addresses.length ? (
              <div className={s.block}>
                <p className="t-small c-text-2">Addresses</p>
                <div>
                  {p.addresses.map((a) => (
                    <Address key={a.address} a={a} />
                  ))}
                </div>
              </div>
            ) : null}
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
