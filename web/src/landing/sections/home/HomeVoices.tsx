"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { SourceLink } from "../../components/SourceLink";
import { bnb } from "../../components/Bnb";
import { voices } from "../../content/voices";
import s from "./HomeVoices.module.css";

/* Each source stays on screen this long before the slider moves on (paused on hover, focus or an off-screen page). */
const DWELL_MS = 7000;
/* Template spring for state changes: duration 0.35s, bounce 0. */
const spring = { type: "spring", duration: 0.45, bounce: 0 } as const;

function Tick() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={s.tick}>
      <path d="M4.5 12.75 9.75 18 19.5 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M15 4.5 7.5 12l7.5 7.5" : "M9 4.5 16.5 12 9 19.5"}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** "Who named this problem": a source slider. Left, the sources as tabs (name and date); the active one carries a
 *  progress underline and the slider advances by itself. Right, the source's dated quote in a framed card with corner
 *  marks, verification ticks and the link. Click, arrow keys or swipe to move; hover or focus pauses it.
 *  Quotes are exact unless marked as a paraphrase (content/voices.ts, docs/landing/sources.md). */
export function HomeVoices() {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const inView = useInView(root, { amount: 0.35 });
  const touch = useRef<{ x: number; y: number } | null>(null);
  const n = voices.length;
  const playing = !reduce && inView && !hovered && !focused && !hidden;

  const go = useCallback((i: number, focusTab = false) => {
    const next = (i + n) % n;
    setActive(next);
    if (focusTab) tabs.current[next]?.focus();
  }, [n]);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* Keep the active tab visible in the phone's horizontal list without scrolling the page. */
  useEffect(() => {
    const list = listRef.current;
    const tab = tabs.current[active];
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce]);

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (e.key in map) {
      e.preventDefault();
      go(active + map[e.key], true);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      go(n - 1, true);
    }
  };

  return (
    <Section name="Who named this problem" id="research" surface contentClassName={s.content}>
      <div className={s.headingGroup}>
        <Eyebrow>Who named this problem</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="The gap has been on the record for years."
          second="Researchers, investors and BNB Chain itself named it."
        />
        <p className={["t-body", s.lede].join(" ")}>
          Five sources, each dated and linked. Every quote is exact.
        </p>
      </div>

      <div
        ref={root}
        className={s.slider}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
        }}
      >
        <div ref={listRef} className={s.list} role="tablist" aria-label="Sources" aria-orientation="vertical" onKeyDown={onKey}>
          {voices.map((x, i) => {
            const on = i === active;
            return (
              <button
                key={x.href}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`voice-tab-${i}`}
                aria-selected={on}
                aria-controls="voice-panel"
                tabIndex={on ? 0 : -1}
                className={[s.tab, on ? s.tabOn : ""].join(" ")}
                onClick={() => go(i)}
              >
                <span className={["t-h4", s.tabName].join(" ")}>{bnb(x.who)}</span>
                <span className="t-small c-text-2">
                  {x.date} {" · "} {x.topic}
                </span>
                <span className={s.track} aria-hidden="true">
                  {on ? (
                    <span
                      key={`${active}-${reduce ? "r" : "p"}`}
                      className={[s.bar, reduce ? s.barStatic : ""].join(" ")}
                      style={{ animationDuration: `${DWELL_MS}ms`, animationPlayState: playing ? "running" : "paused" }}
                      onAnimationEnd={() => go(active + 1)}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={s.stage}
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(t.clientY - start.y)) go(active + (dx < 0 ? 1 : -1));
          }}
        >
          <div className={s.frame} id="voice-panel" role="tabpanel" aria-labelledby={`voice-tab-${active}`} aria-live="polite">
            <span className={[s.corner, s.cTL].join(" ")} aria-hidden="true" />
            <span className={[s.corner, s.cBR].join(" ")} aria-hidden="true" />
            {/* Every card sits in the same grid cell, so the frame is as tall as the tallest one and never jumps;
                only the active card is visible and reachable. */}
            <div className={s.cards}>
              {voices.map((x, i) => {
                const on = i === active;
                return (
                  <motion.figure
                    key={x.href}
                    className={s.card}
                    aria-hidden={!on}
                    inert={!on}
                    initial={false}
                    animate={on ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 8, filter: "blur(4px)" }}
                    transition={reduce ? { duration: 0 } : spring}
                    style={{ visibility: on ? "visible" : "hidden", transitionProperty: "visibility", transitionDelay: on ? "0s" : "0.45s" }}
                  >
                    <p className={["t-small c-text-2", s.date].join(" ")}>{x.date}</p>
                    <blockquote className={s.quote}>
                      {x.paraphrase ? bnb(x.quote) : <>“{bnb(x.quote)}”</>}
                    </blockquote>
                    <figcaption className={s.byline}>
                      <span className="t-label">{bnb(x.who)}</span>
                      <span className="t-small c-text-2">{bnb(x.role)}</span>
                    </figcaption>
                    <ul className={s.checks} aria-label="Checks">
                      <li className="t-small c-text-2">
                        <Tick /> dated
                      </li>
                      <li className="t-small c-text-2">
                        <Tick /> source linked
                      </li>
                      <li className="t-small c-text-2">
                        <Tick /> {x.paraphrase ? "paraphrase, labelled" : "exact quote"}
                      </li>
                    </ul>
                    <div className={s.answer}>
                      <p className="t-small c-accent">Covenant’s answer</p>
                      <p className="t-body c-text">{bnb(x.answer)}</p>
                      <SourceLink href={x.href}>{x.sourceLabel}</SourceLink>
                    </div>
                  </motion.figure>
                );
              })}
            </div>
          </div>
          <div className={s.controls}>
            <p className="t-small c-text-2" aria-hidden="true">
              {String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </p>
            <div className={s.arrows}>
              <button type="button" className={s.arrow} onClick={() => go(active - 1)} aria-label="Previous source">
                <Chevron dir="left" />
              </button>
              <button type="button" className={s.arrow} onClick={() => go(active + 1)} aria-label="Next source">
                <Chevron dir="right" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
