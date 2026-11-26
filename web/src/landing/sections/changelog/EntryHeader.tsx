"use client";
import Link from "next/link";
import { motion } from "motion/react";
import type { Milestone } from "../../content/milestones";
import { Section } from "../../components/Section";
import { formatLongDate } from "./format";
import { IconArrowLeft } from "./icons";
import s from "./Entry.module.css";

const MotionLink = motion.create(Link);

/** Entry Header (EWO1Z2kfC): back link, meta row (date, version, tag), title (H1), summary (Lead). */
export function EntryHeader({ m }: { m: Milestone }) {
  return (
    <Section name="Entry Header" head contentClassName={s.headerContent}>
      {/* Back Link hover: x -4px, scale 1.1, spring 0.3s bounce 0. */}
      <MotionLink
        href="/changelog"
        className={s.back}
        whileHover={{ x: -4, scale: 1.1 }}
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      >
        <IconArrowLeft size={14} className="c-text-2" />
        <span className="t-label c-text-2">All milestones</span>
      </MotionLink>
      <div className={s.metaRow}>
        <p className="t-label c-text-2">{formatLongDate(m.date)}</p>
        <span className={s.version}>
          <span className="t-small c-text-2">v</span>
          <span className="t-small c-text-2">{m.version}</span>
        </span>
        <span className={s.tag}>
          <span className={s.dot} />
          <span className="t-small c-accent">{m.tag}</span>
        </span>
      </div>
      <h1 className={["t-h1", s.title].join(" ")}>{m.title}</h1>
      <p className={["t-lead", s.summary].join(" ")}>{m.summary}</p>
    </Section>
  );
}
