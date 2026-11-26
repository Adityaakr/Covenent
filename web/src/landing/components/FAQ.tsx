"use client";
import { useId, useState } from "react";
import { motion } from "motion/react";
import { IconPlus } from "./icons";
import s from "./FAQ.module.css";

/* Framer component FAQ Item (VrMDv2AIP): Closed / Open / Closed Hover. Tap toggles Closed <-> Open.
   All variant changes: spring, duration 0.35s, bounce 0. */
const transition = { type: "spring", duration: 0.35, bounce: 0 } as const;
const SURFACE = "rgb(244, 245, 247)";
const BG_CLEAR = "rgba(244, 245, 247, 0)";

export function FAQItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  const id = useId();
  return (
    <div className={s.item} data-framer-name="FAQ Item" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={s.row}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
      >
        <h4 className={["t-h4", s.question].join(" ")}>{q}</h4>
        <motion.span
          className={s.icon}
          initial={false}
          animate={{ rotate: open ? 45 : 0, backgroundColor: open || hover ? SURFACE : BG_CLEAR }}
          transition={transition}
          aria-hidden="true"
        >
          <IconPlus size={14} />
        </motion.span>
      </button>
      <motion.div
        id={id}
        className={s.answerClip}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={transition}
        aria-hidden={!open}
      >
        <div className={s.answer}>
          <p className="t-body">{a}</p>
        </div>
      </motion.div>
    </div>
  );
}

/** Stacked FAQ list with a 1px top border (as `FAQ List` on Home). */
export function FAQList({ items, className }: { items: { q: string; a: string }[]; className?: string }) {
  return (
    <div className={[s.list, className ?? ""].filter(Boolean).join(" ")} data-framer-name="FAQ List">
      {items.map((it) => (
        <FAQItem key={it.q} q={it.q} a={it.a} />
      ))}
    </div>
  );
}
