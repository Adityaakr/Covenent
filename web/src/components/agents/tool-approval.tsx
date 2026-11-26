"use client";

/*
 * ToolApproval (beUI's tool-approval): a request the user must approve before anything runs. A header (a status icon
 * that changes with the request, the title, the tool in monospace and a status badge that rolls to the next label),
 * a one-line description, parameter rows (label left, value right), any extra body, and a footer for the actions.
 * ToolApprovalCode is a "Show raw call" disclosure for the exact call data.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/app/icons";
import { ThinkingMark } from "@/components/app/mark";
import { cx } from "@/components/app/ui";
import { AgentDisclosure } from "./disclosure";

export type ToolApprovalStatus = "pending" | "approving" | "approved" | "denied" | "running" | "complete" | "error";

export const toolApprovalLabels: Record<ToolApprovalStatus, string> = {
  pending: "Approval required", approving: "Approving", approved: "Approved", denied: "Denied", running: "Running", complete: "Completed", error: "Failed",
};

export interface ToolApprovalParameter { id: string; label: ReactNode; value: ReactNode }

export interface ToolApprovalProps {
  title: ReactNode;
  /** the tool or call, in monospace under the title */
  tool?: ReactNode;
  description?: ReactNode;
  status?: ToolApprovalStatus;
  /** the idle icon (default a shield) */
  icon?: IconName;
  parameters?: ToolApprovalParameter[];
  labels?: Partial<Record<ToolApprovalStatus, string>>;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const TONE: Record<ToolApprovalStatus, string> = { pending: "warn", approving: "accent", running: "accent", approved: "good", complete: "good", denied: "neutral", error: "bad" };

export function ToolApproval({ title, tool, description, status = "pending", icon = "shieldCheck", parameters = [], labels, children, footer, className }: ToolApprovalProps) {
  const reduce = useReducedMotion() ?? false;
  const busy = status === "approving" || status === "running";
  const label = { ...toolApprovalLabels, ...labels }[status];
  return (
    <section className={cx("ag-card ag-approval", `is-${status}`, className)} data-state={status} aria-busy={busy} aria-label={typeof title === "string" ? title : undefined}>
      <header className="ag-card-head">
        <span className={cx("ag-card-ic", `tone-${status === "pending" ? "accent" : TONE[status]}`)} aria-hidden="true">
          {busy ? <ThinkingMark size={15} /> : <Icon name={status === "error" ? "alert" : status === "denied" ? "x" : status === "complete" || status === "approved" ? "check" : icon} size={16} />}
        </span>
        <div className="ag-card-title">
          <h4>{title}</h4>
          {tool ? <div className="ag-card-tool">{tool}</div> : null}
        </div>
        <span className={cx("ag-badge", `tone-${TONE[status]}`)}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={status} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={{ duration: 0.18 }} style={{ display: "block" }}>
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
      </header>
      {description ? <p className="ag-card-desc">{description}</p> : null}
      {parameters.length ? (
        <dl className="ag-params">
          {parameters.map((p) => <div key={p.id} className="ag-param"><dt>{p.label}</dt><dd>{p.value}</dd></div>)}
        </dl>
      ) : null}
      {children}
      {footer ? <footer className="ag-card-foot">{footer}</footer> : null}
    </section>
  );
}

export function ToolApprovalCode({ code, label = "Show raw call", openLabel = "Hide raw call" }: { code: string; label?: string; openLabel?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="ag-raw">
      <button type="button" className="ag-raw-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name="chevronRight" size={13} className={cx("ag-raw-chev", open && "is-open")} />{open ? openLabel : label}
      </button>
      <AgentDisclosure id={id} open={open}>
        <pre className="ag-raw-code mono">{code}</pre>
      </AgentDisclosure>
    </div>
  );
}

/** An inline callout inside a card: a warning, a problem, or a note. */
export function Callout({ tone = "warn", icon, children }: { tone?: "warn" | "bad" | "good" | "accent"; icon?: IconName; children: ReactNode }) {
  return (
    <div className={cx("ag-callout", `tone-${tone}`)} role={tone === "bad" ? "alert" : undefined}>
      <Icon name={icon ?? (tone === "good" ? "shieldCheck" : tone === "accent" ? "info" : "alert")} size={15} />
      <div className="ag-callout-body">{children}</div>
    </div>
  );
}
