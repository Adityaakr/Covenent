/*
 * Agent components for Ask AI, after beUI's agent kit (beui.dev, MIT): the same component names, props and behaviour,
 * drawn with Covenant's tokens and icons (components/agents/agents.css) instead of beUI's shadcn theme, and without
 * its sound engine, shiki or floating-ui dependencies.
 *
 * ThinkingShimmer: a soft light sweeping across a short status line while the model works. Still under reduced motion.
 */
import type { ReactNode } from "react";
import { cx } from "@/components/app/ui";

export interface ThinkingShimmerProps {
  children?: ReactNode;
  /** seconds per sweep */
  duration?: number;
  className?: string;
}

export function ThinkingShimmer({ children = "Thinking…", duration = 1.8, className }: ThinkingShimmerProps) {
  return <span className={cx("ag-shimmer", className)} style={{ animationDuration: `${duration}s` }}>{children}</span>;
}
