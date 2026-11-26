"use client";
import { motion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { Button } from "../../components/Button";
import { plans } from "../../content/plans";
import s from "./HomePricing.module.css";

/* Phosphor regular "Check", width 1.5, accent. */
function IconCheck() {
  return (
    <svg width={14} height={14} viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={16}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="40 144 96 200 224 72" />
    </svg>
  );
}

/* Plan Card (pgW6y25wr) hoverEffect, exact Framer values:
   y -4px, scale 1.1, shadow 0px 24px 48px -24px rgba(21,23,28,0.22), spring duration 0.35s bounce 0. */
const rest = { y: 0, scale: 1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0)" };
const hover = { y: -4, scale: 1.1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0.22)" };
const transition = { type: "spring", duration: 0.35, bounce: 0 } as const;

/** Framer section "Pricing Preview" (sDxb7qiFd): Plans CMS sorted by Order, here content/plans in array order. */
export function HomePricing() {
  return (
    <Section name="Pricing Preview" contentClassName={s.content}>
      <div className={s.headingGroup}>
        <Eyebrow className={s.eyebrow}>Fees</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="Free to raise. Free to buy."
          second="We earn from fee paths that already exist."
        />
      </div>
      <div className={s.list}>
        {plans.map((p) => (
          <motion.div
            key={p.slug}
            className={s.card}
            initial={false}
            animate="rest"
            whileHover="hover"
            variants={{ rest, hover }}
            transition={transition}
          >
            <div className={s.head}>
              <h4 className={["t-h4", s.name].join(" ")}>{p.name}</h4>
              {p.highlighted ? (
                <div className={s.badge}>
                  <p className="t-small c-bg">{p.badge ?? "Most popular"}</p>
                </div>
              ) : null}
            </div>
            <p className={["t-body", s.fill].join(" ")}>{p.description}</p>
            <div className={s.priceRow}>
              <h2 className="t-h2">{p.price}</h2>
              <p className="t-small c-text-2">{p.unit}</p>
            </div>
            <Button variant="primary" href={p.buttonHref} className={s.button}>
              {p.buttonLabel}
            </Button>
            <ul className={s.features}>
              {p.features.map((f) => (
                <li key={f} className={s.feature}>
                  <span className={s.check}>
                    <IconCheck />
                  </span>
                  <p className={["t-small", s.featureText].join(" ")}>{f}</p>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
