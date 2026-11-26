"use client";

/*
 * PromptInput (beUI's prompt-input): a textarea that grows from minRows to maxRows, Enter to send and Shift+Enter for
 * a new line (never while an IME is composing), and one round button that is Send while idle and Stop while the agent
 * works. Suggestion chips and a footer note sit with it in the same frame.
 */
import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { cx } from "@/components/app/ui";

export interface PromptInputProps {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: (v: string) => void;
  loading?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
  /** shown above the field (suggestion chips) */
  header?: ReactNode;
  /** shown under the field (a note) */
  footer?: ReactNode;
  label?: string;
  className?: string;
}

const LINE = 22;

export function PromptInput({ value, onValueChange, onSubmit, loading = false, onStop, disabled = false, placeholder, minRows = 1, maxRows = 6, maxLength = 2000, header, footer, label = "Message", className }: PromptInputProps) {
  const ta = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    const pad = 20;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minRows * LINE + pad), maxRows * LINE + pad)}px`;
  }, [value, minRows, maxRows]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (loading || disabled || !value.trim()) return;
    onSubmit(value.trim());
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  return (
    <div className={cx("ag-prompt-wrap", className)}>
      {header}
      <form className={cx("ag-prompt", disabled && "is-disabled")} onSubmit={send}>
        <textarea
          ref={ta}
          value={value}
          rows={minRows}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKey}
        />
        {loading ? (
          <button className="ag-prompt-btn is-stop" type="button" onClick={onStop} aria-label="Stop">
            <span className="ag-stop-sq" aria-hidden="true" />
          </button>
        ) : (
          <button className="ag-prompt-btn" type="submit" disabled={disabled || !value.trim()} aria-label="Send">
            <Icon name="up" size={16} strokeWidth={2} />
          </button>
        )}
      </form>
      {footer}
    </div>
  );
}
