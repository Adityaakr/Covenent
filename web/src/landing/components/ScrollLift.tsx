"use client";
import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

export type ScrollLiftProps = { y?: number; scale?: number; className?: string; children?: ReactNode };

/**
 * Framer styleTransformEffect (trigger onInView, viewport end, spring 500/60/1). On the live template it is scroll
 * linked and reversible: progress = (viewport height - element top) / element height, clamped to 0..1, so the element
 * is at `y`/`scale` while its top sits at the viewport bottom and at rest once its bottom reaches it (measured on
 * the live site: App Window and Feature panels move linearly with scroll, both directions). The spring smooths it.
 */
export function ScrollLift({ y = 32, scale = 0.98, className, children }: ScrollLiftProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 500, damping: 60, mass: 1 });
  const ty = useTransform(progress, [0, 1], [y, 0]);
  const s = useTransform(progress, [0, 1], [scale, 1]);
  if (reduce) {
    return (
      <div ref={ref} className={className} data-scroll-lift="">
        {children}
      </div>
    );
  }
  return (
    <motion.div ref={ref} className={className} style={{ y: ty, scale: s }} data-scroll-lift="">
      {children}
    </motion.div>
  );
}
