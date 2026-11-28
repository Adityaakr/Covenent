/*
 * Docs diagrams as inline SVG in the site's tokens (docs.css: .dg-*), so they follow the light and dark themes.
 * Each diagram has a wide drawing and a narrow one for phones; CSS shows one. The text version of each is in
 * docs/diagram-text.ts (markdown twin, llms-full.txt, screen readers): keep the two in step.
 */
import type { ReactNode } from "react";
import { ARCHITECTURE_LAYERS, DIAGRAM_TEXT, LIFECYCLE_STEPS, SIGNING_STEPS, STREAK_EXAMPLE, type DiagramName } from "./diagram-text";

function Arrow({ id }: { id: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" className="dg-head" />
    </marker>
  );
}

function Svg({ w, h, label, className, children }: { w: number; h: number; label: string; className: string; children: ReactNode }) {
  return (
    <svg className={`dg ${className}`} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  );
}

/** A box with a title and up to two lines under it. */
function Card({ x, y, w, h, title, sub = [], kind }: { x: number; y: number; w: number; h: number; title: string; sub?: readonly string[]; kind?: "key" | "end" }) {
  const cls = kind === "key" ? "dg-box dg-key" : kind === "end" ? "dg-box dg-end" : "dg-box";
  const top = sub.length === 2 ? y + 21 : y + h / 2 - (sub.length ? 3 : -5);
  return (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx="12" className={cls} />
      <text x={x + 14} y={top} className="dg-title dg-title-s">{title}</text>
      {sub.map((line, j) => (
        <text key={j} x={x + 14} y={top + 17 + j * 15} className="dg-sub dg-sub-s">{line}</text>
      ))}
    </g>
  );
}

// ── step flows: lifecycle (five steps) and signing (four) ─────────────────

function StepFlow({ steps, keyIndex, id, label }: { steps: readonly { title: string; sub: readonly string[] }[]; keyIndex: number; id: string; label: string }) {
  const n = steps.length;
  const W = 760, bw = n >= 5 ? 136 : 166, bh = 100, y = 10, gap = (W - n * bw) / (n - 1);
  const VW = 340, vh = 58, vgap = 22;
  return (
    <>
      <Svg w={W} h={bh + 20} label={label} className="dg-wide">
        <defs><Arrow id={`${id}-h`} /></defs>
        {steps.map((s, i) => {
          const x = i * (bw + gap);
          const key = i === keyIndex;
          return (
            <g key={s.title}>
              <rect x={x + 0.5} y={y + 0.5} width={bw - 1} height={bh - 1} rx="14" className={key ? "dg-box dg-key" : "dg-box"} />
              <circle cx={x + 22} cy={y + 24} r="10" className={key ? "dg-dot dg-dot-key" : "dg-dot"} />
              <text x={x + 22} y={y + 28} textAnchor="middle" className="dg-num">{i + 1}</text>
              <text x={x + 40} y={y + 29} className="dg-title">{s.title}</text>
              {s.sub.map((line, j) => (
                <text key={j} x={x + 12} y={y + 58 + j * 16} className="dg-sub dg-sub-s">{line}</text>
              ))}
              {i < n - 1 && <line x1={x + bw + 4} y1={y + bh / 2} x2={x + bw + gap - 5} y2={y + bh / 2} className="dg-line" markerEnd={`url(#${id}-h)`} />}
            </g>
          );
        })}
      </Svg>
      <Svg w={VW} h={n * vh + (n - 1) * vgap + 2} label={label} className="dg-narrow">
        <defs><Arrow id={`${id}-v`} /></defs>
        {steps.map((s, i) => {
          const y0 = 1 + i * (vh + vgap);
          const key = i === keyIndex;
          return (
            <g key={s.title}>
              <rect x="1" y={y0} width={VW - 2} height={vh} rx="12" className={key ? "dg-box dg-key" : "dg-box"} />
              <circle cx="26" cy={y0 + vh / 2} r="11" className={key ? "dg-dot dg-dot-key" : "dg-dot"} />
              <text x="26" y={y0 + vh / 2 + 4} textAnchor="middle" className="dg-num">{i + 1}</text>
              <text x="48" y={y0 + 24} className="dg-title">{s.title}</text>
              <text x="48" y={y0 + 43} className="dg-sub">{s.sub.join(" ")}</text>
              {i < n - 1 && <line x1={VW / 2} y1={y0 + vh + 3} x2={VW / 2} y2={y0 + vh + vgap - 4} className="dg-line" markerEnd={`url(#${id}-v)`} />}
            </g>
          );
        })}
      </Svg>
    </>
  );
}

const Lifecycle = () => <StepFlow steps={LIFECYCLE_STEPS} keyIndex={2} id="lc" label="Raise, launch, vault, budget, exit" />;
const Signing = () => (
  <StepFlow steps={SIGNING_STEPS} keyIndex={2} id="sg" label="An agent calls an MCP tool, the server builds and simulates an unsigned transaction, a wallet signs it, the chain enforces the rules" />
);

// ── handoff: a trust-me raise against a covenant ─────────────────────────

const RISKS = ["Spending it all in a week", "Selling its own tokens", "Going silent with the treasury"];

function HandoffPanels({ narrow }: { narrow: boolean }) {
  const pw = narrow ? 338 : 330;
  const lx = 1, ly = 1;
  const rx = narrow ? 1 : 349, ry = narrow ? 230 : 1;
  const lh = narrow ? 212 : 234, rh = narrow ? 226 : 234;
  const bw = narrow ? 112 : 112, gap = narrow ? 40 : 44;
  const tw = pw - 34 - bw - gap; // the box right of the arrow
  const pad = 17;
  const id = narrow ? "ho-v" : "ho-h";
  // right panel outputs
  const ow = (pw - 2 * pad - 10) / 2;
  const vaultCx = rx + pad + bw + gap + tw / 2;
  const teamCx = rx + pad + ow / 2, holdCx = rx + pad + ow + 10 + ow / 2;
  const branchY = ry + 118;
  return (
    <>
      <defs><Arrow id={id} /></defs>
      {/* today */}
      <rect x={lx + 0.5} y={ly + 0.5} width={pw - 1} height={lh - 1} rx="16" className="dg-panel" />
      <text x={lx + pad} y={ly + 28} className="dg-title dg-title-s">Today: a trust-me handoff</text>
      <Card x={lx + pad} y={ly + 46} w={bw} h={46} title="Buyers" />
      <line x1={lx + pad + bw + 4} y1={ly + 69} x2={lx + pad + bw + gap - 5} y2={ly + 69} className="dg-line" markerEnd={`url(#${id})`} />
      <Card x={lx + pad + bw + gap} y={ly + 46} w={tw} h={46} title="Team wallet" sub={["all of the money"]} />
      <text x={lx + pad} y={ly + 124} className="dg-sub">Nothing stops the team from:</text>
      {RISKS.map((r, i) => (
        <g key={r}>
          <circle cx={lx + pad + 7} cy={ly + 147 + i * 26} r="7" className="dg-bad-dot" />
          <path d={`M ${lx + pad + 4.5} ${ly + 144.5 + i * 26} l 5 5 m 0 -5 l -5 5`} className="dg-bad-x" />
          <text x={lx + pad + 22} y={ly + 151 + i * 26} className="dg-bad-t">{r}</text>
        </g>
      ))}
      {/* with Covenant */}
      <rect x={rx + 0.5} y={ry + 0.5} width={pw - 1} height={rh - 1} rx="16" className="dg-box dg-key" />
      <text x={rx + pad} y={ry + 28} className="dg-title dg-title-s">With Covenant</text>
      <Card x={rx + pad} y={ry + 46} w={bw} h={46} title="Buyers" />
      <line x1={rx + pad + bw + 4} y1={ry + 69} x2={rx + pad + bw + gap - 5} y2={ry + 69} className="dg-line" markerEnd={`url(#${id})`} />
      <Card x={rx + pad + bw + gap} y={ry + 46} w={tw} h={46} title="Vault" sub={["rules in code"]} />
      <path d={`M ${vaultCx} ${ry + 96} V ${branchY} M ${teamCx} ${branchY} H ${holdCx}`} className="dg-line" fill="none" />
      <line x1={teamCx} y1={branchY} x2={teamCx} y2={ry + 134} className="dg-line" markerEnd={`url(#${id})`} />
      <line x1={holdCx} y1={branchY} x2={holdCx} y2={ry + 134} className="dg-line" markerEnd={`url(#${id})`} />
      <Card x={rx + pad} y={ry + 139} w={ow} h={56} title="Team or agent" sub={["a capped budget"]} />
      <Card x={rx + pad + ow + 10} y={ry + 139} w={ow} h={56} title="Holders" sub={["exit at book value"]} />
      <text x={rx + pad} y={ry + 222} className="dg-sub">Anyone can trigger the rules, 24/7.</text>
    </>
  );
}

function Handoff() {
  const label = "Today buyers send BNB to the team's wallet with no rules; with Covenant they send it to a vault that pays a capped budget and lets holders exit at book value";
  return (
    <>
      <Svg w={680} h={236} label={label} className="dg-wide"><HandoffPanels narrow={false} /></Svg>
      <Svg w={340} h={458} label={label} className="dg-narrow"><HandoffPanels narrow /></Svg>
    </>
  );
}

// ── money flow ────────────────────────────────────────────────────────────

function MoneyFlow() {
  const label = "Buyers commit to the launcher; it refunds the excess, seeds the pool and funds the vault; the vault pays the capped budget to the team and redemptions to holders";
  return (
    <>
      <Svg w={760} h={296} label={label} className="dg-wide">
        <defs><Arrow id="mf-h" /></defs>
        <Card x={0} y={118} w={104} h={58} title="Buyers" sub={["commit BNB"]} />
        <line x1={108} y1={147} x2={141} y2={147} className="dg-line" markerEnd="url(#mf-h)" />
        <Card x={146} y={118} w={122} h={58} title="Launcher" sub={["holds the raise"]} />
        <path d="M 272 147 H 292 M 292 37 V 257" className="dg-line" fill="none" />
        {[37, 147, 257].map((y) => <line key={y} x1={292} y1={y} x2={313} y2={y} className="dg-line" markerEnd="url(#mf-h)" />)}
        <Card x={318} y={8} w={190} h={58} title="Refunds" sub={["above the cap, to buyers"]} />
        <Card x={318} y={118} w={190} h={58} title="PancakeSwap pool" sub={["seeded with 25% of the raise"]} />
        <Card x={318} y={226} w={190} h={64} title="Vault treasury" sub={["the other 75%", "+ tax, revenue, exit fees"]} kind="key" />
        <line x1={413} y1={180} x2={413} y2={221} className="dg-line" markerEnd="url(#mf-h)" />
        <text x={421} y={205} className="dg-edge">trading tax</text>
        <path d="M 512 247 H 538 V 201 H 565" className="dg-line" fill="none" markerEnd="url(#mf-h)" />
        <line x1={512} y1={267} x2={565} y2={267} className="dg-line" markerEnd="url(#mf-h)" />
        <Card x={570} y={176} w={189} h={50} title="Team or agent" sub={["the capped budget"]} />
        <Card x={570} y={242} w={189} h={50} title="Holders" sub={["redeem at book value"]} />
        <text x={570} y={30} className="dg-edge">Money leaves the vault</text>
        <text x={570} y={46} className="dg-edge">only these two ways.</text>
      </Svg>
      <Svg w={340} h={430} label={label} className="dg-narrow">
        <defs><Arrow id="mf-v" /></defs>
        <Card x={1} y={1} w={338} h={48} title="Buyers" sub={["commit BNB"]} />
        <line x1={170} y1={53} x2={170} y2={69} className="dg-line" markerEnd="url(#mf-v)" />
        <Card x={1} y={74} w={338} h={48} title="Launcher" sub={["holds the raise"]} />
        <path d="M 20 126 V 310" className="dg-line" fill="none" />
        {[164, 228, 310].map((y) => <line key={y} x1={20} y1={y} x2={35} y2={y} className="dg-line" markerEnd="url(#mf-v)" />)}
        <Card x={40} y={140} w={299} h={48} title="Refunds" sub={["above the cap, to buyers"]} />
        <Card x={40} y={204} w={299} h={48} title="PancakeSwap pool" sub={["seeded with 25% of the raise"]} />
        <line x1={300} y1={256} x2={300} y2={273} className="dg-line" markerEnd="url(#mf-v)" />
        <text x={292} y={268} textAnchor="end" className="dg-edge">trading tax</text>
        <Card x={40} y={278} w={299} h={64} title="Vault treasury" sub={["the other 75%", "+ tax, revenue, exit fees"]} kind="key" />
        <line x1={112} y1={346} x2={112} y2={363} className="dg-line" markerEnd="url(#mf-v)" />
        <line x1={267} y1={346} x2={267} y2={363} className="dg-line" markerEnd="url(#mf-v)" />
        <Card x={40} y={368} w={144} h={58} title="Team or agent" sub={["the capped budget"]} />
        <Card x={195} y={368} w={144} h={58} title="Holders" sub={["redeem at book"]} />
      </Svg>
    </>
  );
}

// ── states ────────────────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number; name: string; kind?: "key" | "end" };
function StateBox({ b }: { b: Box }) {
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="12" className={b.kind === "key" ? "dg-box dg-key" : b.kind === "end" ? "dg-box dg-end" : "dg-box"} />
      <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4.5} textAnchor="middle" className="dg-state">{b.name}</text>
    </g>
  );
}

function States() {
  const label = "Covenant states: RAISING, ACTIVE, EXIT_ROUND, COOLDOWN, and the terminal FAILED and WIND_DOWN";
  // wide
  const bw = 128, bh = 44;
  const R: Box = { x: 8, y: 56, w: bw, h: bh, name: "RAISING" };
  const F: Box = { x: 8, y: 196, w: bw, h: bh, name: "FAILED", kind: "end" };
  const A: Box = { x: 226, y: 56, w: bw, h: bh, name: "ACTIVE" };
  const E: Box = { x: 420, y: 56, w: bw, h: bh, name: "EXIT_ROUND", kind: "key" };
  const C: Box = { x: 614, y: 56, w: bw, h: bh, name: "COOLDOWN" };
  const D: Box = { x: 420, y: 196, w: bw, h: bh, name: "WIND_DOWN", kind: "end" };
  const mid = (b: Box) => b.y + b.h / 2;
  // narrow
  const nw = 132, nh = 40, lx = 30, rx = 340 - nw - 2;
  const nR: Box = { x: lx, y: 8, w: nw, h: nh, name: "RAISING" };
  const nF: Box = { x: rx, y: 8, w: nw, h: nh, name: "FAILED", kind: "end" };
  const nA: Box = { x: lx, y: 104, w: nw, h: nh, name: "ACTIVE" };
  const nE: Box = { x: lx, y: 200, w: nw, h: nh, name: "EXIT_ROUND", kind: "key" };
  const nC: Box = { x: lx, y: 296, w: nw, h: nh, name: "COOLDOWN" };
  const nD: Box = { x: rx, y: 200, w: nw, h: nh, name: "WIND_DOWN", kind: "end" };
  const bx = lx + nw + 22; // the bracket that gathers the live states
  return (
    <>
      <Svg w={760} h={250} label={label} className="dg-wide">
        <defs><Arrow id="st-h" /></defs>
        <line x1={R.x + R.w + 4} y1={mid(R)} x2={A.x - 5} y2={mid(A)} className="dg-line" markerEnd="url(#st-h)" />
        <text x={(R.x + R.w + A.x) / 2} y={mid(R) - 9} textAnchor="middle" className="dg-edge">finalize</text>
        <line x1={R.x + R.w / 2} y1={R.y + R.h + 4} x2={F.x + F.w / 2} y2={F.y - 5} className="dg-line" markerEnd="url(#st-h)" />
        <text x={R.x + R.w / 2 + 10} y={(R.y + R.h + F.y) / 2 + 4} className="dg-edge">missed minimum</text>
        <line x1={A.x + A.w + 4} y1={mid(A)} x2={E.x - 5} y2={mid(E)} className="dg-line" markerEnd="url(#st-h)" />
        <text x={(A.x + A.w + E.x) / 2} y={mid(A) - 9} textAnchor="middle" className="dg-edge">streak full</text>
        <line x1={E.x + E.w + 4} y1={mid(E)} x2={C.x - 5} y2={mid(C)} className="dg-line" markerEnd="url(#st-h)" />
        <text x={(E.x + E.w + C.x) / 2} y={mid(E) - 9} textAnchor="middle" className="dg-edge">round ends</text>
        <path d={`M ${C.x + C.w / 2} ${C.y - 4} V 22 H ${A.x + A.w / 2} V ${A.y - 5}`} className="dg-line" fill="none" markerEnd="url(#st-h)" />
        <text x={(A.x + C.x + C.w) / 2} y={16} textAnchor="middle" className="dg-edge">cooldown ends</text>
        <path d={`M ${A.x + A.w / 2} ${A.y + A.h + 4} V 146 H ${C.x + C.w / 2} V ${C.y + C.h + 4} M ${E.x + E.w / 2} ${E.y + E.h + 4} V 146`} className="dg-bracket" fill="none" />
        <line x1={D.x + D.w / 2} y1={146} x2={D.x + D.w / 2} y2={D.y - 5} className="dg-line" markerEnd="url(#st-h)" />
        <text x={D.x + D.w / 2 + 10} y={176} className="dg-edge">abandoned or wound down</text>
        {[R, F, A, E, C, D].map((b) => <StateBox key={b.name} b={b} />)}
      </Svg>
      <Svg w={340} h={346} label={label} className="dg-narrow">
        <defs><Arrow id="st-v" /></defs>
        <line x1={nR.x + nR.w + 4} y1={nR.y + nh / 2} x2={nF.x - 5} y2={nF.y + nh / 2} className="dg-line" markerEnd="url(#st-v)" />
        <text x={(nR.x + nR.w + nF.x) / 2} y={nR.y + nh + 14} textAnchor="middle" className="dg-edge">missed min.</text>
        {[[nR, nA, "finalize"], [nA, nE, "streak full"], [nE, nC, "round ends"]].map(([a, b, t]) => {
          const from = a as Box, to = b as Box;
          return (
            <g key={t as string}>
              <line x1={from.x + from.w / 2} y1={from.y + nh + 4} x2={to.x + to.w / 2} y2={to.y - 5} className="dg-line" markerEnd="url(#st-v)" />
              <text x={from.x + from.w / 2 + 9} y={(from.y + nh + to.y) / 2 + 4} className="dg-edge">{t as string}</text>
            </g>
          );
        })}
        <path d={`M ${nC.x - 4} ${nC.y + nh / 2} H 12 V ${nA.y + nh / 2} H ${nA.x - 5}`} className="dg-line" fill="none" markerEnd="url(#st-v)" />
        <text transform={`translate(8 ${(nA.y + nC.y + nh) / 2}) rotate(-90)`} textAnchor="middle" className="dg-edge">cooldown ends</text>
        <path d={`M ${nA.x + nw + 4} ${nA.y + nh / 2} H ${bx} M ${nE.x + nw + 4} ${nE.y + nh / 2} H ${bx} M ${nC.x + nw + 4} ${nC.y + nh / 2} H ${bx} M ${bx} ${nA.y + nh / 2} V ${nC.y + nh / 2}`} className="dg-bracket" fill="none" />
        <line x1={bx} y1={nD.y + nh / 2} x2={nD.x - 5} y2={nD.y + nh / 2} className="dg-line" markerEnd="url(#st-v)" />
        <text x={nD.x + nw / 2} y={nD.y - 20} textAnchor="middle" className="dg-edge">abandoned or</text>
        <text x={nD.x + nw / 2} y={nD.y - 7} textAnchor="middle" className="dg-edge">wound down</text>
        {[nR, nF, nA, nE, nC, nD].map((b) => <StateBox key={b.name} b={b} />)}
      </Svg>
    </>
  );
}

// ── exit streak over time ─────────────────────────────────────────────────

/** The streak (hours) at each knot of the example, for the decaying rule and for a rule that resets. */
function streakSeries() {
  const decay: [number, number][] = [[0, 0]];
  const reset: [number, number][] = [[0, 0]];
  let d = 0, r = 0;
  for (const p of STREAK_EXAMPLE.phases) {
    const dt = p.to - p.from;
    if (p.below) { d = Math.min(d + dt, STREAK_EXAMPLE.targetHours); r += dt; }
    else { d = Math.max(d - dt, 0); if (r > 0) reset.push([p.from, 0]); r = 0; }
    decay.push([p.to, d]);
    reset.push([p.to, r]);
  }
  const open = STREAK_EXAMPLE.roundOpensAt, end = STREAK_EXAMPLE.endHours;
  decay.push([open, 0], [end, 0]); // the round opens and the streak starts again from zero; it does not step in a round
  reset.push([end, r + (end - open)]); // the resetting rule never opened a round, so it keeps counting
  return { decay, reset };
}

// The pool price of the example, as a share of the panel: 0 is the book line, positive above it.
const PRICE: [number, number][] = [
  [0, -0.55], [6, -0.45], [12, -0.62], [18, -0.5], [24, -0.7], [30, -0.52], [36, -0.66], [42, -0.48], [47, -0.42],
  [49, 0.5], [52, 0.62], [55, 0.55], [58, 0.66], [59.5, 0.42],
  [61, -0.5], [66, -0.62], [72, -0.48], [78, -0.7], [84, -0.56], [90, -0.66], [96, -0.6], [102, -0.72], [108, -0.66],
];

function Streak() {
  const label = "Exit streak over four and a half days: below book it rises, twelve hours above book take twelve hours off, and the exit round opens at hour 96; a streak that resets never reaches the target";
  const { decay, reset } = streakSeries();
  const draw = (narrow: boolean) => {
    const x0 = narrow ? 52 : 70, x1 = narrow ? 332 : 742;
    const px = (h: number) => x0 + (h / STREAK_EXAMPLE.endHours) * (x1 - x0);
    const top = narrow ? { y0: 26, y1: 96 } : { y0: 28, y1: 104 };
    const bookY = (top.y0 + top.y1) / 2;
    const half = (top.y1 - top.y0) / 2 - 4;
    const priceY = (v: number) => bookY - v * half;
    const bot = narrow ? { base: 232, peak: 140 } : { base: 252, peak: 148 };
    const sy = (s: number) => bot.base - (s / STREAK_EXAMPLE.targetHours) * (bot.base - bot.peak);
    const pts = (xs: [number, number][], f: (v: number) => number) => xs.map(([h, v]) => `${px(h).toFixed(1)},${f(v).toFixed(1)}`).join(" ");
    const open = STREAK_EXAMPLE.roundOpensAt;
    const ticksY = bot.base + 18;
    const legendY = narrow ? [ticksY + 26, ticksY + 46] : [ticksY + 30, ticksY + 30];
    const legendX = narrow ? [x0 - 46, x0 - 46] : [x0, x0 + 290];
    return (
      <>
        {/* below-book bands and the exit round */}
        {STREAK_EXAMPLE.phases.filter((p) => p.below).map((p) => (
          <rect key={p.from} x={px(p.from)} y={top.y0} width={px(Math.min(p.to, open)) - px(p.from)} height={top.y1 - top.y0} className="dg-below" />
        ))}
        <rect x={px(open)} y={top.y0 - 8} width={px(STREAK_EXAMPLE.endHours) - px(open)} height={bot.base - top.y0 + 8} className="dg-zone" />
        <text x={px(open) + 6} y={top.y0 + 4} className="dg-accent-t">{narrow ? "round" : "exit round"}</text>
        {/* axes and guides */}
        <text x={0} y={bookY + 4} className="dg-axis-t">PRICE</text>
        <text x={0} y={(bot.base + bot.peak) / 2 + 4} className="dg-axis-t">STREAK</text>
        <line x1={x0} y1={bookY} x2={x1} y2={bookY} className="dg-book" />
        <text x={x0 + 4} y={bookY - 6} className="dg-edge">book value</text>
        <text x={px(54)} y={top.y0 - 6} textAnchor="middle" className="dg-edge">above</text>
        <text x={px(24)} y={top.y1 + 14} textAnchor="middle" className="dg-edge">below book</text>
        <polyline points={pts(PRICE, priceY)} className="dg-twap" />
        <line x1={x0} y1={bot.base} x2={x1} y2={bot.base} className="dg-grid" />
        <line x1={x0} y1={bot.peak} x2={x1} y2={bot.peak} className="dg-target" />
        <text x={x0 + 4} y={bot.peak - 6} className="dg-accent-t">target: 3 days</text>
        <polyline points={pts(reset, sy)} className="dg-reset" />
        <polyline points={pts(decay, sy)} className="dg-decay" />
        <circle cx={px(open)} cy={sy(STREAK_EXAMPLE.targetHours)} r="4.5" className="dg-dot-key" />
        {[0, 24, 48, 72, 96].map((h) => (
          <g key={h}>
            <line x1={px(h)} y1={bot.base} x2={px(h)} y2={bot.base + 4} className="dg-grid" />
            <text x={px(h)} y={ticksY} textAnchor={h === 0 ? "start" : "middle"} className="dg-tick">{`day ${h / 24}`}</text>
          </g>
        ))}
        {/* legend */}
        <line x1={legendX[0]! + 40} y1={legendY[0]! - 4} x2={legendX[0]! + 64} y2={legendY[0]! - 4} className="dg-decay" />
        <text x={legendX[0]! + 72} y={legendY[0]} className="dg-edge">Covenant: time above book is taken off</text>
        <line x1={legendX[1]! + 40} y1={legendY[1]! - 4} x2={legendX[1]! + 64} y2={legendY[1]! - 4} className="dg-reset" />
        <text x={legendX[1]! + 72} y={legendY[1]} className="dg-edge">A streak that resets never gets there</text>
      </>
    );
  };
  return (
    <>
      <Svg w={760} h={310} label={label} className="dg-wide">{draw(false)}</Svg>
      <Svg w={340} h={318} label={label} className="dg-narrow">{draw(true)}</Svg>
    </>
  );
}

// ── architecture: four layers ─────────────────────────────────────────────

function Architecture() {
  const label = "Architecture: people and agents, off-chain services, Covenant contracts, partner contracts";
  const W = 760, tw = 176, bh = 58, gap = 18;
  const VW = 340, per = 3, chipH = 26;
  const layout = ARCHITECTURE_LAYERS.map((l) => Math.ceil(l.items.length / per));
  const vHeights = layout.map((rows) => 34 + rows * (chipH + 6) + 6);
  const vTotal = vHeights.reduce((a, b) => a + b, 0) + gap * (ARCHITECTURE_LAYERS.length - 1);
  const vTops = vHeights.map((_, i) => vHeights.slice(0, i).reduce((a, b) => a + b + gap, 0));
  return (
    <>
      <Svg w={W} h={ARCHITECTURE_LAYERS.length * (bh + gap) - gap + 2} label={label} className="dg-wide">
        <defs><Arrow id="ar-h" /></defs>
        {ARCHITECTURE_LAYERS.map((l, i) => {
          const y = 1 + i * (bh + gap);
          const key = i === 2;
          const area = W - tw - 14;
          const cw = (area - (l.items.length - 1) * 8) / l.items.length;
          return (
            <g key={l.title}>
              <rect x="1" y={y} width={W - 2} height={bh} rx="14" className={key ? "dg-box dg-key" : "dg-box"} />
              <text x="16" y={y + bh / 2 + 4.5} className="dg-title dg-title-s">{l.title.replace(/ \(.*\)$/, "")}</text>
              {l.items.map((it, j) => (
                <g key={it}>
                  <rect x={tw + j * (cw + 8)} y={y + 13} width={cw} height={bh - 26} rx="8" className="dg-chip" />
                  <text x={tw + j * (cw + 8) + cw / 2} y={y + bh / 2 + 4} textAnchor="middle" className="dg-chip-t">{it}</text>
                </g>
              ))}
              {i > 0 && <line x1={W / 2} y1={y - gap + 3} x2={W / 2} y2={y - 4} className="dg-line" markerEnd="url(#ar-h)" />}
            </g>
          );
        })}
      </Svg>
      <Svg w={VW} h={vTotal + 2} label={label} className="dg-narrow">
        <defs><Arrow id="ar-v" /></defs>
        {ARCHITECTURE_LAYERS.map((l, i) => {
          const y = 1 + vTops[i]!;
          const h = vHeights[i]!;
          const key = i === 2;
          const cw = (VW - 24 - (per - 1) * 6) / per;
          return (
            <g key={l.title}>
              {i > 0 && <line x1={VW / 2} y1={y - gap + 3} x2={VW / 2} y2={y - 4} className="dg-line" markerEnd="url(#ar-v)" />}
              <rect x="1" y={y} width={VW - 2} height={h} rx="12" className={key ? "dg-box dg-key" : "dg-box"} />
              <text x="12" y={y + 22} className="dg-title dg-title-s">{l.title.replace(/ \(.*\)$/, "")}</text>
              {l.items.map((it, j) => {
                const cx = 12 + (j % per) * (cw + 6), cy = y + 34 + Math.floor(j / per) * (chipH + 6);
                return (
                  <g key={it}>
                    <rect x={cx} y={cy} width={cw} height={chipH} rx="7" className="dg-chip" />
                    <text x={cx + cw / 2} y={cy + chipH / 2 + 4} textAnchor="middle" className="dg-chip-t">{it}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </Svg>
    </>
  );
}

const DRAW: Record<DiagramName, () => ReactNode> = {
  handoff: Handoff,
  lifecycle: Lifecycle,
  moneyflow: MoneyFlow,
  states: States,
  streak: Streak,
  signing: Signing,
  architecture: Architecture,
};

const CAPTION: Record<DiagramName, string> = {
  handoff: "A raise today ends in the team's wallet. With Covenant it ends in a vault whose rules pay the team a budget and give holders a way out.",
  lifecycle: "From a raise to an exit. Everything after the raise is enforced by the vault.",
  moneyflow: "Where every BNB goes, with the default split. Tax and revenue raise book value; the budget and redemptions are the only ways out.",
  states: "The six states of a covenant. FAILED and WIND_DOWN are final.",
  streak: "Below book the streak builds; above book it decays by the same time. Twelve hours above book cost twelve hours, not two days.",
  signing: "The MCP server builds and simulates; only a wallet signs. The vault enforces the rules whatever is signed.",
  architecture: "Wallets sign. The API and the MCP server never hold a key; the keeper and the agents sign only with their own.",
};

export function Diagram({ name }: { name: DiagramName }) {
  const Draw = DRAW[name];
  return (
    <figure className="docs-figure">
      <div className="docs-figure-art">
        <Draw />
      </div>
      <figcaption>{CAPTION[name]}</figcaption>
      <div className="sr-only">{DIAGRAM_TEXT[name].replace(/[*`]/g, "")}</div>
    </figure>
  );
}

export const isDiagram = (n: string): n is DiagramName => n in DRAW;
