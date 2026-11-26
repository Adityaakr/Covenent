"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ScrollLift } from "./ScrollLift";
import s from "./FeatureGrid.module.css";

/** `Capabilities Grid` on /features: Border fill, gap 1px, radius 18, 1px border, clip; 3 / 2 columns, Phone one stack.
 *  Scroll lift from y 32px, scale 0.98. */
export function FeatureGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollLift className={[s.grid, className ?? ""].filter(Boolean).join(" ")}>
      {children}
    </ScrollLift>
  );
}

/** Feature Card (Gb5Q7P0K_): Background card, padding 32 (Phone 24 20), gap 14; 36px Surface icon box
 *  (radius 10, 1px Border, 18px icon); Text/H4 title; Text/Body line. Hover: Surface fill + scale 1.1 (verified on the live template), tween 0.25s (0.44,0,0.56,1). */
export function FeatureCard({ icon, title, body }: { icon: ReactNode; title: ReactNode; body: ReactNode }) {
  return (
    <motion.div
      className={s.card}
      data-framer-name="Feature Card"
      initial={false}
      whileHover={{ backgroundColor: "rgb(244, 245, 247)", scale: 1.1 }}
      transition={{ type: "tween", ease: [0.44, 0, 0.56, 1], duration: 0.25 }}
    >
      <div className={s.iconBox}>{icon}</div>
      <h4 className={["t-h4", s.text].join(" ")}>{title}</h4>
      <p className={["t-body", s.text].join(" ")}>{body}</p>
    </motion.div>
  );
}
