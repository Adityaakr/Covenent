"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { useCases } from "../../content/useCases";
import s from "./HomeUseCases.module.css";

const MotionLink = motion.create(Link);

/* Template "Arrow Right" (tree.toSVG): short shaft plus a stroked closed triangle head, 24 viewBox, stroke 1.5. */
function IconArrowRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.75 12H13.5M13.5 5.25L20.25 12L13.5 18.75Z" />
    </svg>
  );
}

/* Story Card (KMi1pvSEa) hoverEffect, exact Framer values:
   y -4px, scale 1.1, shadow 0px 24px 48px -24px rgba(21,23,28,0.25), spring duration 0.35s bounce 0. */
const rest = { y: 0, scale: 1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0)" };
const hover = { y: -4, scale: 1.1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0.25)" };
const transition = { type: "spring", duration: 0.35, bounce: 0 } as const;

/** Framer section "Stories" (PXR78n2mP): first 3 items of the Stories CMS, here content/useCases. */
export function HomeUseCases() {
  const items = useCases.slice(0, 3);
  return (
    <Section name="Stories">
      <div className={s.header}>
        <div className={s.headingGroup}>
          <Eyebrow className={s.fill}>Use cases</Eyebrow>
          <SplitHeading
            className={s.heading}
            first="One vault for every issuer."
            second="Agents, teams and launchpads raise under the same rules."
          />
        </div>
        <Link href="/use-cases" className={s.link}>
          <span className="t-label">All use cases</span>
          <IconArrowRight />
        </Link>
      </div>
      <div className={s.list}>
        {items.map((u) => (
          <MotionLink
            key={u.slug}
            href={`/use-cases/${u.slug}`}
            className={s.card}
            initial={false}
            animate="rest"
            whileHover="hover"
            variants={{ rest, hover }}
            transition={transition}
          >
            <div className={s.cover}>
              <img src={u.cover} alt={u.name} width={600} height={440} loading="lazy" />
            </div>
            <div className={s.meta}>
              <div className={s.company}>
                <span className={s.mark}>{u.mark}</span>
                <p className={["t-label", s.companyName].join(" ")}>{u.name}</p>
                <p className={["t-small c-text-2", s.industry].join(" ")}>{u.category}</p>
              </div>
              <h4 className={["t-h4", s.fill].join(" ")}>{u.headline}</h4>
              <div className={s.result}>
                <h4 className={["t-h4 c-accent", s.resultValue].join(" ")}>{u.result}</h4>
                <p className={["t-small c-text-2", s.resultLabel].join(" ")}>{u.resultLabel}</p>
              </div>
            </div>
          </MotionLink>
        ))}
      </div>
    </Section>
  );
}
