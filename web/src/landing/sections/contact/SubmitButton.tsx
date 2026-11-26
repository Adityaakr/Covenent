"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import s from "./SubmitButton.module.css";

/* Framer component Submit Button (isiuHjqjc). Variants share padding 0 18px, radius 10px, height 44px, gap 8px,
   label Text/Label in Background, transition spring duration 0.4s bounce 0.2.
   Default: Text Primary fill. Default Hover (gesture hover): Accent fill. Pending: Text Secondary fill, "Sending…".
   Success: Accent fill. Error: Text Primary fill, "Error. Please try again". */
export type SubmitState = "default" | "pending" | "success" | "error";

const TEXT = "rgb(21, 23, 28)";
const TEXT_2 = "rgb(107, 115, 130)";
const ACCENT = "rgb(43, 89, 255)";
const transition = { type: "spring", duration: 0.4, bounce: 0.2 } as const;

const fills: Record<SubmitState | "hover", { backgroundColor: string }> = {
  default: { backgroundColor: TEXT },
  hover: { backgroundColor: ACCENT },
  pending: { backgroundColor: TEXT_2 },
  success: { backgroundColor: ACCENT },
  error: { backgroundColor: TEXT },
};

export const submitLabels = { pending: "Sending…", success: "Thank you", error: "Error. Please try again" } as const;

export function SubmitButton({ label, state, className }: { label: string; state: SubmitState; className?: string }) {
  const text = state === "default" ? label : submitLabels[state];
  return (
    <motion.button
      type="submit"
      className={[s.button, className ?? ""].filter(Boolean).join(" ")}
      variants={fills}
      initial={false}
      animate={state}
      whileHover={state === "default" ? "hover" : undefined}
      transition={transition}
      aria-live="polite"
      disabled={state === "pending"}
    >
      <span className={["t-label c-bg", s.label].join(" ")}>{text}</span>
    </motion.button>
  );
}

/** No backend: on submit prevent default, show Pending briefly, then Success (the Framer form's success variant). */
export function useFakeSubmit(pendingMs = 900) {
  const [state, setState] = useState<SubmitState>("default");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (state === "pending") return;
      setState("pending");
      timer.current = setTimeout(() => setState("success"), pendingMs);
    },
    [state, pendingMs],
  );
  return { state, onSubmit };
}
