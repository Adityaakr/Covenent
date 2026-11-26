"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { IconArrowRight, IconBell } from "./icons";
import s from "./Entry.module.css";

const MotionLink = motion.create(Link);

/** Entry Subscribe (LAx95AQIr): link to /changelog. Hover: scale 1.1 and fill Surface -> Background, tween 0.2s ease (0.44,0,0.56,1). */
export function EntrySubscribe() {
  return (
    <MotionLink
      href="/changelog"
      className={s.subscribe}
      initial={false}
      style={{ backgroundColor: "rgb(244, 245, 247)" }}
      whileHover={{ backgroundColor: "rgb(255, 255, 255)", scale: 1.1 }}
      transition={{ type: "tween", ease: [0.44, 0, 0.56, 1], duration: 0.2 }}
    >
      <IconBell size={20} className={["c-accent", s.subscribeIcon].join(" ")} />
      <span className={s.subscribeText}>
        <span className="t-label">Get a note at each gate</span>
        <span className="t-small c-text-2">Follow the build on the milestones page. No emails yet.</span>
      </span>
      <IconArrowRight size={16} className={["c-text", s.subscribeIcon].join(" ")} />
    </MotionLink>
  );
}
