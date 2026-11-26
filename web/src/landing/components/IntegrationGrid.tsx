"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import s from "./IntegrationGrid.module.css";

/** `Integrations Grid` on /features: gap 12px; 4 columns Desktop, 2 on Tablet and Phone. */
export function IntegrationGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[s.grid, className ?? ""].filter(Boolean).join(" ")}>{children}</div>;
}

/** Integration Tile (ApInVGTjW): Background card, 1px Border, radius 14, padding 20, gap 10; 22px icon;
 *  Text/Label title; Text/Small body in Text Secondary. Hover: y -3px, scale 1.1, shadow (verified on the live template), spring 0.3s bounce 0. */
export function IntegrationTile({ icon, title, body }: { icon: ReactNode; title: ReactNode; body: ReactNode }) {
  return (
    <motion.div
      className={s.tile}
      data-framer-name="Integration Tile"
      initial={false}
      style={{ boxShadow: "0px 16px 32px -16px rgba(21, 23, 28, 0)" }}
      whileHover={{ y: -3, scale: 1.1, boxShadow: "0px 16px 32px -16px rgba(21, 23, 28, 0.22)" }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
    >
      <span className={s.icon}>{icon}</span>
      <p className={["t-label", s.text].join(" ")}>{title}</p>
      <p className={["t-small c-text-2", s.text].join(" ")}>{body}</p>
    </motion.div>
  );
}
