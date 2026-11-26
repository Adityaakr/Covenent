"use client";

/*
 * ApprovalCard (beUI's approval-card), the question form: the agent asks one question with options and the user
 * clicks one, or writes their own when allowCustom is set. A click answers at once (the card's onSubmit), then the
 * card settles to show what was picked. Arrow keys move between options.
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { cx } from "@/components/app/ui";

export type ApprovalCardStatus = "pending" | "submitting" | "answered";
export interface ApprovalCardOption { value: string; label: string; description?: string; disabled?: boolean }
export interface ApprovalCardQuestion { id: string; title: ReactNode; description?: ReactNode; options: ApprovalCardOption[]; allowCustom?: boolean; customPlaceholder?: string }
export interface ApprovalCardAnswer { selected: string[]; custom?: string }

export interface ApprovalCardProps {
  question: ApprovalCardQuestion;
  status?: ApprovalCardStatus;
  /** the answer once given (shows the picked option) */
  answer?: ApprovalCardAnswer;
  onSubmit?: (a: ApprovalCardAnswer) => void;
  disabled?: boolean;
  className?: string;
}

export function ApprovalCard({ question, status = "pending", answer, onSubmit, disabled = false, className }: ApprovalCardProps) {
  const [custom, setCustom] = useState("");
  const settled = status !== "pending";
  const picked = answer?.selected[0];
  const choose = (value: string) => { if (!settled && !disabled) onSubmit?.({ selected: [value] }); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button.ag-option:not([disabled])")];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next = btns[(i + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length];
    if (next) { e.preventDefault(); next.focus(); }
  };

  return (
    <section className={cx("ag-card ag-choice", settled && "is-settled", className)} aria-label={typeof question.title === "string" ? question.title : "Choose an option"}>
      <header className="ag-card-head">
        <span className="ag-card-ic tone-accent" aria-hidden="true"><Icon name={settled ? "check" : "sliders"} size={16} /></span>
        <div className="ag-card-title">
          <h4>{question.title}</h4>
          {question.description ? <div className="ag-card-sub">{question.description}</div> : null}
        </div>
        {settled ? <span className="ag-badge tone-good">{status === "submitting" ? "Sending" : "Answered"}</span> : <span className="ag-badge tone-accent">Pick one</span>}
      </header>
      <div className="ag-options" role="group" onKeyDown={onKey}>
        {question.options.map((o, i) => {
          const on = picked === o.value;
          return (
            <button key={o.value} type="button" className={cx("ag-option", on && "is-picked", settled && !on && "is-dim")} disabled={o.disabled || disabled || settled} aria-pressed={on} onClick={() => choose(o.value)}>
              <span className="ag-option-key" aria-hidden="true">{on ? <Icon name="check" size={13} strokeWidth={2} /> : i + 1}</span>
              <span className="ag-option-text">
                <span className="ag-option-label">{o.label}</span>
                {o.description ? <span className="ag-option-desc">{o.description}</span> : null}
              </span>
              {!settled ? <Icon name="arrow" size={14} className="ag-option-go" /> : null}
            </button>
          );
        })}
      </div>
      {question.allowCustom && !settled ? (
        <form className="ag-option-custom" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) onSubmit?.({ selected: [], custom: custom.trim() }); }}>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={300} disabled={disabled} placeholder={question.customPlaceholder ?? "Or say something else…"} aria-label="Your own answer" />
          <button type="submit" className="ag-icon-btn" disabled={disabled || !custom.trim()} aria-label="Send your answer"><Icon name="up" size={14} strokeWidth={2} /></button>
        </form>
      ) : null}
      {settled && answer?.custom ? <p className="ag-card-desc">You said: {answer.custom}</p> : null}
    </section>
  );
}
