"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import s from "./HomeFeatures.module.css";

/* Framer component "Feature Index" (ZZU0_EyGl), variants Step 1..4. On the page the instance carries a
   scrollVariantEffect: trigger onScrollTarget, threshold 0.5, replay true, targets = the four Feature Blocks
   (elementId feature-1..4). A target becomes current when its top passes 50% of the viewport height; scrolling
   back up returns to the earlier step. Variant transition: spring, duration 0.4s, bounce 0.
   Active item: marker Accent, text opacity 1. Others: marker Border, text opacity 0.45.
   Server render is Step 1 (the primary variant), so the index is complete without JavaScript. */

const transition = { type: "spring", duration: 0.4, bounce: 0 } as const;
const ACCENT = "rgb(43, 89, 255)";
const BORDER = "rgb(227, 230, 235)";

export function FeatureIndex({ items, targets }: { items: string[]; targets: string[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.5;
      let next = 0;
      targets.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) next = i;
      });
      setActive(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targets]);

  return (
    <div className={s.index}>
      {items.map((label, i) => (
        <div key={label} className={s.indexItem}>
          <motion.span
            className={s.indexMarker}
            initial={false}
            animate={{ backgroundColor: i === active ? ACCENT : BORDER }}
            transition={transition}
          />
          <motion.p
            className={["t-h4", s.indexText].join(" ")}
            initial={false}
            animate={{ opacity: i === active ? 1 : 0.45 }}
            transition={transition}
          >
            {label}
          </motion.p>
        </div>
      ))}
    </div>
  );
}
