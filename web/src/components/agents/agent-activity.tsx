"use client";

/*
 * AgentActivity (beUI's agent-activity): one collapsible log of what the agent did. While it works the header is a
 * shimmering live line and the rows stay open; when it completes the header becomes "Done in 4s" with a chevron and
 * the rows fold away (collapseOnComplete). Each step is one clean row: an icon, a human label, a short muted result.
 */
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { cx } from "@/components/app/ui";
import { AgentDisclosure } from "./disclosure";
import { ThinkingShimmer } from "./thinking-shimmer";

export type AgentActivityStatus = "working" | "complete";
export type AgentStepStatus = "pending" | "active" | "complete" | "error";

export interface AgentActivityStep {
  id: string;
  type: "step";
  label: ReactNode;
  status?: AgentStepStatus;
  /** short result, shown muted at the end of the row */
  meta?: ReactNode;
  /** full text for the row's tooltip (a truncated meta) */
  title?: string;
  icon?: ReactNode;
}
export interface AgentActivityText { id: string; type: "text"; content: ReactNode }
export type AgentActivityItem = AgentActivityStep | AgentActivityText;

export interface AgentActivityProps {
  items: AgentActivityItem[];
  status?: AgentActivityStatus;
  /** label while working (default "Working…") */
  activeLabel?: ReactNode;
  /** header once complete (default "Done") */
  summary?: ReactNode;
  defaultOpen?: boolean;
  collapseOnComplete?: boolean;
  /** rows taller than this scroll (px) */
  maxHeight?: number;
  className?: string;
}

function StepMarker({ status, icon }: { status: AgentStepStatus; icon?: ReactNode }) {
  if (status === "active") return <span className="ag-step-dot" aria-hidden="true"><span /></span>;
  if (status === "error") return <span className="ag-step-ic bad" aria-hidden="true"><Icon name="alert" size={14} /></span>;
  if (status === "pending") return <span className="ag-step-ic faint" aria-hidden="true"><span className="ag-ring" /></span>;
  return <span className="ag-step-ic" aria-hidden="true">{icon ?? <Icon name="check" size={14} />}</span>;
}

export function AgentActivity({ items, status = "working", activeLabel = "Working…", summary = "Done", defaultOpen = false, collapseOnComplete = true, maxHeight = 220, className }: AgentActivityProps) {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  // fold once when the work completes; a click after that is the user's
  const [prev, setPrev] = useState(status);
  if (prev !== status) {
    setPrev(status);
    if (prev === "working" && status === "complete" && collapseOnComplete) setOpen(false);
  }
  const working = status === "working";
  const expanded = working || open;

  return (
    <div className="ag-activity" data-state={working ? "working" : expanded ? "open" : "closed"} aria-busy={working}>
      {working ? (
        <div className="ag-activity-head" role="status" id={`${id}-t`}>
          <ThinkingShimmer>{activeLabel}</ThinkingShimmer>
        </div>
      ) : (
        <button type="button" className="ag-activity-head" id={`${id}-t`} aria-expanded={expanded} aria-controls={`${id}-c`} onClick={() => setOpen(!open)}>
          <span className="trunc">{summary}</span>
          <motion.span aria-hidden="true" className="ag-chev" animate={{ rotate: expanded ? 180 : 0 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}>
            <Icon name="chevronDown" size={14} />
          </motion.span>
        </button>
      )}
      <AgentDisclosure id={`${id}-c`} open={expanded}>
        <div role="list" aria-labelledby={`${id}-t`} className={cx("ag-activity-list", className)} style={{ maxHeight }}>
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.div
                key={it.id}
                role="listitem"
                layout="position"
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={reduce ? { duration: 0 } : { opacity: { duration: 0.18 }, y: { type: "spring", stiffness: 420, damping: 36 } }}
              >
                {it.type === "text" ? <div className="ag-activity-text">{it.content}</div> : (
                  <div className={cx("ag-step", `is-${it.status ?? "complete"}`)} title={it.title}>
                    <StepMarker status={it.status ?? "complete"} icon={it.icon} />
                    <span className="ag-step-label">{it.label}</span>
                    {it.meta ? <span className="ag-step-meta">{it.meta}</span> : null}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </AgentDisclosure>
    </div>
  );
}
