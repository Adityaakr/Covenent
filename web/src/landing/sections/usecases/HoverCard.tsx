"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";

const MotionLink = motion.create(Link);

/* Framer hover effects on the CMS cards (scale 1.1 is stored on every template hover and is applied on the
   live site, per the lead's check).
   story: Story Card, y -4px, scale 1.1, shadow 0px 24px 48px -24px rgba(21,23,28,0.25), spring 0.35s bounce 0.
   featured: Featured Card, scale 1.1, shadow 0px 30px 60px -30px rgba(21,23,28,0.25), spring 0.4s bounce 0. */
const variants = {
  story: {
    rest: { y: 0, scale: 1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0)" },
    hover: { y: -4, scale: 1.1, boxShadow: "0px 24px 48px -24px rgba(21, 23, 28, 0.25)" },
    transition: { type: "spring", duration: 0.35, bounce: 0 },
  },
  featured: {
    rest: { scale: 1, boxShadow: "0px 30px 60px -30px rgba(21, 23, 28, 0)" },
    hover: { scale: 1.1, boxShadow: "0px 30px 60px -30px rgba(21, 23, 28, 0.25)" },
    transition: { type: "spring", duration: 0.4, bounce: 0 },
  },
} as const;

export function HoverCard({
  href,
  kind,
  className,
  children,
}: {
  href: string;
  kind: "story" | "featured";
  className?: string;
  children: ReactNode;
}) {
  const v = variants[kind];
  return (
    <MotionLink
      href={href}
      className={className}
      initial={false}
      animate="rest"
      whileHover="hover"
      variants={{ rest: v.rest, hover: v.hover }}
      transition={v.transition}
    >
      {children}
    </MotionLink>
  );
}

/* Back Link hover: x -4px, scale 1.1, spring 0.3s bounce 0. */
export function BackLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <MotionLink
      href={href}
      className={className}
      initial={false}
      whileHover={{ x: -4, scale: 1.1 }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
    >
      {children}
    </MotionLink>
  );
}
