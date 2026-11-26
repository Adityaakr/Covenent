"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { Section } from "../../components/Section";
import { Eyebrow } from "../../components/Eyebrow";
import { SplitHeading } from "../../components/SplitHeading";
import { SourceLink } from "../../components/SourceLink";
import { bnb } from "../../components/Bnb";
import { problemDemand, problemGroups, type ProblemGroup } from "../../content/problem";
import s from "./HomeProblem.module.css";

/* Step dwell while the story plays by itself (it stops once someone picks a step or a track). */
const STEP_MS = 3800;
/* Markers sit over the centres of the four step columns. */
const MARKER_X = [0.125, 0.375, 0.625, 0.875];
const VB_W = 1000;
const VB_H = 200;
const spring = { type: "spring", duration: 0.6, bounce: 0 } as const;

/** Smooth path through the curve points (Catmull-Rom to cubic Bézier), in viewBox units. */
function pathFor(points: [number, number][]) {
  const p = points.map(([x, y]) => [x * VB_W, (1 - y) * VB_H] as const);
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** y (0..1, 1 = top) of the curve at x, by linear interpolation between points: enough to seat a marker. */
function yAt(points: [number, number][], x: number) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return points[points.length - 1][1];
}

/** A number that counts up from zero the first time it is on screen, keeping its prefix, suffix and format. */
function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    const m = value.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
    if (!el || !m || !inView || reduce) return;
    const [, pre, num, post] = m;
    const target = parseFloat(num.replace(/,/g, ""));
    const decimals = (num.split(".")[1] ?? "").length;
    const commas = num.includes(",");
    const controls = animate(0, target, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        const f = commas
          ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : v.toFixed(decimals);
        el.textContent = `${pre}${f}${post}`;
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value]);
  return (
    <span ref={ref} className={className} aria-label={value}>
      {value}
    </span>
  );
}

function Chart({ g, active }: { g: ProblemGroup; active: number }) {
  const reduce = useReducedMotion();
  const d = pathFor(g.curve);
  const ax = MARKER_X[active] * VB_W;
  return (
    <div className={s.chart} aria-hidden="true">
      <svg className={s.svg} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill-${g.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(43, 89, 255)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="rgb(43, 89, 255)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`reach-${g.id}`}>
            <motion.rect
              x={0}
              y={0}
              height={VB_H}
              initial={false}
              animate={{ width: ax }}
              transition={reduce ? { duration: 0 } : spring}
            />
          </clipPath>
        </defs>
        {MARKER_X.map((x) => (
          <line key={x} x1={x * VB_W} x2={x * VB_W} y1={0} y2={VB_H} className={s.guide} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={`${d} L${VB_W},${VB_H} L0,${VB_H} Z`} fill={`url(#fill-${g.id})`} clipPath={`url(#reach-${g.id})`} />
        <path d={d} className={s.curveBase} vectorEffect="non-scaling-stroke" />
        <motion.path
          key={g.id}
          d={d}
          className={s.curve}
          vectorEffect="non-scaling-stroke"
          clipPath={`url(#reach-${g.id})`}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.44, 0, 0.56, 1] }}
        />
      </svg>
      {MARKER_X.map((x, i) => (
        <span
          key={x}
          className={[s.marker, i === active ? s.markerOn : i < active ? s.markerPast : ""].join(" ")}
          style={{ left: `${x * 100}%`, top: `${(1 - yAt(g.curve, x)) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** "The problem today": two short stories of how money raised in public goes wrong, each four sourced numbers on a
 *  stepped sequence with an illustrative chart. The story plays itself while on screen; picking a track or a step
 *  takes over. Every number links to its source (content/problem.ts, docs/landing/sources.md). */
export function HomeProblem() {
  const [track, setTrack] = useState(0);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.4 });
  const g = problemGroups[track];

  useEffect(() => {
    if (!auto || reduce || !inView || hovered) return;
    const t = setTimeout(() => {
      if (active < 3) setActive(active + 1);
      else {
        setTrack((track + 1) % problemGroups.length);
        setActive(0);
      }
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [auto, reduce, inView, hovered, active, track]);

  const pickTrack = (i: number) => {
    setAuto(false);
    setTrack(i);
    setActive(0);
  };
  const pickStep = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <Section name="Problem" id="problem" contentClassName={s.content}>
      <div className={s.intro}>
        <Eyebrow>The problem today</Eyebrow>
        <SplitHeading
          className={s.heading}
          first="Money raised in public has no rules after launch."
          second="Buyers get no claim, and agents answer to no one."
        />
      </div>

      <div ref={root} className={s.story} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className={s.storyHead}>
          <div className={s.tracks} role="tablist" aria-label="Stories">
            {problemGroups.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={i === track}
                className={[s.trackBtn, i === track ? s.trackOn : ""].join(" ")}
                onClick={() => pickTrack(i)}
              >
                <span className="t-label">{x.title}</span>
              </button>
            ))}
          </div>
          <p className={["t-body", s.note].join(" ")}>{g.note}</p>
        </div>

        <Chart g={g} active={active} />
        <div className={s.axis} aria-hidden="true">
          {g.axis.map((a, i) => (
            <p key={a} className={["t-small", i === active ? "c-text" : "c-text-2"].join(" ")}>
              {a}
            </p>
          ))}
        </div>

        <ol className={s.steps}>
          {g.stats.map((stat, i) => {
            const on = i === active;
            return (
              <li key={`${g.id}-${stat.value}`} className={[s.step, on ? s.stepOn : ""].join(" ")}>
                <button type="button" className={s.stepHit} onClick={() => pickStep(i)} aria-pressed={on}>
                  <span className={s.srOnly}>Show step {i + 1}: {stat.stage}</span>
                </button>
                <span className={s.stepBar} aria-hidden="true">
                  {on && auto && !reduce ? (
                    <span
                      key={`${track}-${active}`}
                      className={s.stepFill}
                      style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: inView && !hovered ? "running" : "paused" }}
                    />
                  ) : on ? (
                    <span className={[s.stepFill, s.stepFillStatic].join(" ")} />
                  ) : null}
                </span>
                <p className={["t-small", s.stage].join(" ")}>
                  <span className={s.stepNo}>{String(i + 1).padStart(2, "0")}</span> {stat.stage}
                </p>
                <CountUp value={stat.value} className={["t-h2", s.value].join(" ")} />
                <p className="t-body">{bnb(stat.label)}</p>
                <SourceLink href={stat.source.href} className={s.source}>
                  {stat.source.label}
                </SourceLink>
              </li>
            );
          })}
        </ol>
        <p className={["t-small c-text-2", s.caption].join(" ")}>
          Illustrative curve: the order of events, not a price series. Every number links to its source.
        </p>
      </div>

      <div className={s.demand}>
        <CountUp value={problemDemand.value} className={["t-h2 c-accent", s.demandValue].join(" ")} />
        <div className={s.demandText}>
          <p className="t-lead c-text">{problemDemand.label}</p>
          <SourceLink href={problemDemand.source.href}>{problemDemand.source.label}</SourceLink>
        </div>
      </div>
    </Section>
  );
}
