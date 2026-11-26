import type { ReactNode } from "react";

/** Section eyebrow: Text/Label in accent. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={["t-label", "c-accent", className ?? ""].filter(Boolean).join(" ")}>{children}</p>;
}
