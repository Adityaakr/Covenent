"use client";
import { useRef } from "react";
import { useAnimationFrame, useReducedMotion } from "motion/react";
import s from "./HomeHero.module.css";

/* "Logo Row Marks" (D09F6HI6d) tickerEffect: velocity 40 (px per second, moving left), hoverModifier 40%
   (runs at 40% speed while hovered), directionModifier default, not draggable. Two copies of the set are
   rendered; the track wraps after one set plus one gap. Without JavaScript the first set shows still. */
export type TickerItem = { name: string; logo: string; scale?: number };

/* The template's marks are 20px icons beside an H4 name. Real logos share that 20px optical height. */
const MARK = 20;

const VELOCITY = 40;
const HOVER_FACTOR = 0.4;

export function LogoTicker({ items }: { items: TickerItem[] }) {
  const track = useRef<HTMLDivElement>(null);
  const firstSet = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const hovered = useRef(false);
  const reduce = useReducedMotion();

  useAnimationFrame((_, delta) => {
    if (reduce || !track.current || !firstSet.current) return;
    const gap = parseFloat(getComputedStyle(track.current).columnGap || "0") || 0;
    const loop = firstSet.current.offsetWidth + gap;
    if (loop <= 0) return;
    const speed = VELOCITY * (hovered.current ? HOVER_FACTOR : 1);
    x.current -= (speed * Math.min(delta, 100)) / 1000;
    if (x.current <= -loop) x.current += loop;
    track.current.style.transform = `translateX(${x.current}px)`;
  });

  const set = (hidden: boolean, ref?: React.Ref<HTMLDivElement>) => (
    <div className={s.markSet} ref={ref} aria-hidden={hidden || undefined}>
      {items.map((it) => (
        <div key={it.name} className={s.mark}>
          {/* Decorative: the name beside it is the accessible label. */}
          <img
            src={it.logo}
            alt=""
            height={Math.round(MARK * (it.scale ?? 1))}
            className={s.markLogo}
            style={{ height: Math.round(MARK * (it.scale ?? 1)) }}
            draggable={false}
          />
          <span className="t-h4">{it.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={s.marks}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <div className={s.markTrack} ref={track}>
        {set(false, firstSet)}
        {set(true)}
      </div>
    </div>
  );
}
