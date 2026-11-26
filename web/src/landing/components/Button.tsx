"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import s from "./Button.module.css";

export type ButtonProps = {
  variant?: "primary" | "secondary";
  href: string;
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
};

const MotionLink = motion.create(Link);

/* Framer component Button (Cd7LjBF5C). All variants share transition: spring, duration 0.25s, bounce 0. */
const transition = { type: "spring", duration: 0.25, bounce: 0 } as const;

const TEXT = "rgb(21, 23, 28)";
const BG = "rgb(255, 255, 255)";
const ACCENT = "rgb(43, 89, 255)";
const SURFACE = "rgb(244, 245, 247)";
const BORDER = "rgb(227, 230, 235)";

const frame = {
  primary: {
    rest: { backgroundColor: TEXT, boxShadow: "inset 0px 2px 4px 0px rgba(0, 0, 0, 0)" },
    hover: { backgroundColor: ACCENT, boxShadow: "inset 0px 2px 4px 0px rgba(0, 0, 0, 0)" },
    pressed: { backgroundColor: ACCENT, boxShadow: "inset 0px 2px 4px 0px rgba(0, 0, 0, 0.25)" },
  },
  secondary: {
    rest: { backgroundColor: BG, boxShadow: "inset 0px 2px 4px 0px rgba(0, 0, 0, 0)" },
    hover: { backgroundColor: SURFACE, boxShadow: "inset 0px 2px 4px 0px rgba(0, 0, 0, 0)" },
    pressed: { backgroundColor: BORDER, boxShadow: "inset 0px 2px 4px 0px rgba(0, 0, 0, 0.08)" },
  },
};
const label = { rest: { scale: 1 }, hover: { scale: 1 }, pressed: { scale: 0.97 } };

/** Button: Primary (Text Primary fill, Background label) / Secondary (Background fill, 1px Border, Text label).
 *  Hover: Primary -> Accent, Secondary -> Surface. Pressed: inset shadow, label scale 0.97. md 40px, lg 44px. */
export function Button({ variant = "primary", href, size = "md", className, children }: ButtonProps) {
  const cls = [s.button, variant === "primary" ? s.primary : s.secondary, size === "lg" ? s.lg : s.md, className ?? ""]
    .filter(Boolean)
    .join(" ");
  const external = /^https?:\/\//.test(href);
  const common = {
    className: cls,
    variants: frame[variant],
    initial: false as const,
    animate: "rest",
    whileHover: "hover",
    whileTap: "pressed",
    transition,
  };
  const inner = (
    <motion.span className={["t-label", s.label].join(" ")} variants={label} transition={transition}>
      {children}
    </motion.span>
  );
  if (external)
    return (
      <motion.a {...common} href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </motion.a>
    );
  return (
    <MotionLink {...common} href={href}>
      {inner}
    </MotionLink>
  );
}
