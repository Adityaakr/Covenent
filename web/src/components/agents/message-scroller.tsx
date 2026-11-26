"use client";

/*
 * MessageScroller (beUI's message-scroller): the conversation's scroll area. It follows the newest content while the
 * reader is at the bottom (instantly while an answer streams, so it never lags; smoothly for a new message) and stops
 * following as soon as they scroll up, offering a "Latest" button to jump back. Content growth is measured with a
 * ResizeObserver, so streamed text, opening cards and collapsing logs all keep the view pinned without jumps.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { cx } from "@/components/app/ui";

const NEAR = 72;

/** pinKey: change it (e.g. the number of messages the user sent) to snap back to following the newest content. */
export function MessageScroller({ children, busy = false, pinKey, className, contentClassName, label = "Conversation" }: { children: ReactNode; busy?: boolean; pinKey?: unknown; className?: string; contentClassName?: string; label?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const lastTop = useRef(0);
  const [away, setAway] = useState(false);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const toBottom = useCallback((smooth: boolean) => {
    const el = viewport.current;
    if (!el) return;
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? "smooth" : "auto" });
  }, []);

  useLayoutEffect(() => {
    const el = content.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last = el.offsetHeight;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      const grew = h - last;
      last = h;
      // big jumps (a new message, a card) glide; streamed text follows instantly
      if (pinned.current) toBottom(!busyRef.current || grew > 160);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [toBottom]);

  useEffect(() => {
    pinned.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the user just sent a message: stop showing "Latest"
    setAway(false);
    toBottom(true);
  }, [pinKey, toBottom]);

  const onScroll = () => {
    const el = viewport.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR;
    // only the reader scrolling up stops the follow; a smooth glide down passes through "far" positions too
    const up = el.scrollTop < lastTop.current - 2;
    lastTop.current = el.scrollTop;
    if (near) { pinned.current = true; setAway(false); } else if (up) { pinned.current = false; setAway(true); }
  };

  return (
    <div className={cx("ag-scroller", className)}>
      <div ref={viewport} className="ag-scroller-viewport" onScroll={onScroll} role="log" aria-label={label} aria-live="polite" aria-busy={busy}>
        <div ref={content} className={cx("ag-scroller-content", contentClassName)}>{children}</div>
      </div>
      {away ? (
        <button type="button" className="ag-scroller-jump" onClick={() => { pinned.current = true; setAway(false); toBottom(true); }}>
          <Icon name="down" size={14} />Latest
        </button>
      ) : null}
    </div>
  );
}
