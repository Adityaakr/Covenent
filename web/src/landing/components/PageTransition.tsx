"use client";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";

/* Layout page effect (Home primary breakpoint pageEffects.all): enter from y 16px, opacity 0,
   tween ease [0.22, 1, 0.36, 1], 0.5s. Runs on client-side navigation only, never on first load. */
let hasMounted = false;

export function PageTransition({ children }: { children: ReactNode }) {
  const [animateIn] = useState(() => typeof window !== "undefined" && hasMounted);
  useEffect(() => {
    hasMounted = true;
  }, []);
  return (
    <motion.main
      style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
      initial={animateIn ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
    >
      {children}
    </motion.main>
  );
}
