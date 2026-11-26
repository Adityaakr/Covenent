"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { milestones } from "../../content/milestones";
import s from "./HomeMilestones.module.css";

const MotionLink = motion.create(Link);

/* Phosphor regular "Arrow Right", width 1.5. */
function IconArrowRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth={16}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="40" y1="128" x2="216" y2="128" />
      <polyline points="144 56 216 128 144 200" />
    </svg>
  );
}

/* Framer date transform toDateString, dateStyle "medium" (en-US), e.g. "Nov 27, 2026". */
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

/* Changelog Entry (ZlJ6Gzkd4) hoverEffect, exact Framer values: x 6px, scale 1.1, spring duration 0.35s bounce 0. */
const rest = { x: 0, scale: 1 };
const hover = { x: 6, scale: 1.1 };
const transition = { type: "spring", duration: 0.35, bounce: 0 } as const;

/** Framer section "Changelog Preview" (zsKT4BHwt): Changelog CMS, date descending, limit 4 (content/milestones). */
export function HomeMilestones() {
  const items = [...milestones].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 4);
  return (
    <Section name="Changelog Preview">
      <div className={s.header}>
        <div className={s.headingGroup}>
          <Eyebrow>Milestones</Eyebrow>
          <SplitHeading
            className={s.fill}
            first="Built in public, gate by gate."
            second="From the design document to Demo Night."
          />
        </div>
        <Link href="/changelog" className={s.link}>
          <span className="t-label">See every milestone</span>
          <IconArrowRight />
        </Link>
      </div>
      <div className={s.list}>
        {items.map((m) => (
          <MotionLink
            key={m.slug}
            href={`/changelog/${m.slug}`}
            className={s.entry}
            initial={false}
            animate="rest"
            whileHover="hover"
            variants={{ rest, hover }}
            transition={transition}
          >
            <div className={s.meta}>
              <p className={["t-label c-text-2", s.date].join(" ")}>{formatDate(m.date)}</p>
              <div className={s.version}>
                <p className="t-small c-text-2">v</p>
                <p className="t-small c-text-2">{m.version}</p>
              </div>
            </div>
            <div className={s.body}>
              <div className={s.tag}>
                <span className={s.tagDot} />
                <p className="t-small c-accent">{m.tag}</p>
              </div>
              <h4 className={["t-h4", s.fill].join(" ")}>{m.title}</h4>
              <p className={["t-body", s.summary].join(" ")}>{m.summary}</p>
            </div>
            <div className={s.cover}>
              <img src={m.cover} alt="" width={480} height={300} loading="lazy" />
            </div>
          </MotionLink>
        ))}
      </div>
    </Section>
  );
}
