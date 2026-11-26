"use client";

/* A clip-and-fade reveal for collapsible agent content (beUI's AgentDisclosure): never an animated height. */
import { motion, useReducedMotion } from "motion/react";
import { useState, type CSSProperties, type ReactNode } from "react";

export function AgentDisclosure({ open, id, children, className, style }: { open: boolean; id?: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  const reduce = useReducedMotion() ?? false;
  const [collapsed, setCollapsed] = useState(!open);
  if (open && collapsed) setCollapsed(false);
  return (
    <motion.div
      id={id}
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={reduce ? { opacity: open ? 1 : 0 } : { opacity: open ? 1 : 0, clipPath: open ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)", y: open ? 0 : -4 }}
      transition={{ duration: reduce ? 0 : open ? 0.22 : 0.14, ease: [0.16, 1, 0.3, 1] }}
      onAnimationComplete={() => { if (!open) setCollapsed(true); }}
      className={className}
      style={{ ...style, overflow: "hidden", height: collapsed ? 0 : "auto", pointerEvents: open ? undefined : "none" }}
    >
      {children}
    </motion.div>
  );
}
