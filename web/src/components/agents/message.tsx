"use client";

/*
 * Message (beUI's message + message-bubble): a row with an avatar, a header (name and time), the content and an
 * optional footer. User rows align to the end with a solid bubble; assistant rows to the start with no bubble, so
 * answers read as a document. animateIn plays a short rise once when a row mounts.
 */
import { motion, useReducedMotion } from "motion/react";
import { createContext, useContext, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/components/app/ui";

export type MessageFrom = "user" | "assistant";
const Side = createContext<MessageFrom>("assistant");

export function MessageGroup({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ag-msg-group", className)} {...p} />;
}

export function Message({ from, animateIn = false, children, className, label }: { from: MessageFrom; animateIn?: boolean; children: ReactNode; className?: string; label?: string }) {
  const reduce = useReducedMotion() ?? false;
  const play = animateIn && !reduce;
  return (
    <Side.Provider value={from}>
      <motion.article
        data-from={from}
        aria-label={label ?? (from === "user" ? "Your message" : "Covenant AI's answer")}
        className={cx("ag-msg", from === "user" ? "is-user" : "is-assistant", className)}
        initial={play ? { opacity: 0, y: 8, scale: 0.98 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 34, mass: 0.62 }}
        style={{ transformOrigin: from === "user" ? "100% 100%" : "0% 100%" }}
      >
        {children}
      </motion.article>
    </Side.Provider>
  );
}

export function MessageAvatar({ children, placeholder, className }: { children?: ReactNode; placeholder?: boolean; className?: string }) {
  return <div className={cx("ag-msg-av", placeholder && "is-placeholder", className)} aria-hidden="true">{placeholder ? null : children}</div>;
}

export function MessageContent({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  const from = useContext(Side);
  return <div className={cx("ag-msg-content", from === "user" && "is-end", className)} {...p} />;
}

export function MessageHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ag-msg-head", className)} {...p} />;
}

export function MessageFooter({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ag-msg-foot", className)} {...p} />;
}

export function MessageBubble({ variant = "solid", className, ...p }: HTMLAttributes<HTMLDivElement> & { variant?: "solid" | "soft" | "ghost" }) {
  return <div className={cx("ag-bubble", `is-${variant}`, className)} {...p} />;
}

export function MessageBubbleContent({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ag-bubble-content", className)} {...p} />;
}

/** "14:05" for today, "26 Nov, 14:05" before. */
export function messageTime(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return new Date(now).toDateString() === d.toDateString() ? t : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${t}`;
}
