"use client";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export type ScrollLiftProps = { y?: number; scale?: number; className?: string; children?: ReactNode };

/** Framer "appear on scroll" effect: from y/scale to rest, spring stiffness 500 damping 60 mass 1, once, viewport end. */
export function ScrollLift({ y = 32, scale = 0.98, className, children }: ScrollLiftProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ y, scale }}
      whileInView={{ y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 60, mass: 1 }}
    >
      {children}
    </motion.div>
  );
}
