/*
 * Docs diagrams as inline SVG in the site's tokens (docs.css: .dg-*), so they follow the light and dark themes.
 * Each diagram has a wide drawing and a narrow one for phones; CSS shows one. The text version of each is in
 * docs/diagram-text.ts (markdown twin, llms-full.txt, screen readers): keep the two in step.
 */
import type { ReactNode } from "react";
import { ARCHITECTURE_LAYERS, DIAGRAM_TEXT, LIFECYCLE_STEPS, type DiagramName } from "./diagram-text";

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

// ── lifecycle: five steps ─────────────────────────────────────────────────

function Lifecycle() {
  const n = LIFECYCLE_STEPS.length;
  const W = 760, bw = 136, bh = 100, y = 10, gap = (W - n * bw) / (n - 1);
  const VW = 340, vh = 58, vgap = 22;
  const label = "Raise, launch, vault, budget, exit";
  return (
    <>
      <Svg w={W} h={bh + 20} label={label} className="dg-wide">
        <defs><Arrow id="lc-h" /></defs>
        {LIFECYCLE_STEPS.map((s, i) => {
          const x = i * (bw + gap);
          const key = i === 2;
          return (
            <g key={s.title}>
              <rect x={x + 0.5} y={y + 0.5} width={bw - 1} height={bh - 1} rx="14" className={key ? "dg-box dg-key" : "dg-box"} />
              <circle cx={x + 22} cy={y + 24} r="10" className={key ? "dg-dot dg-dot-key" : "dg-dot"} />
              <text x={x + 22} y={y + 28} textAnchor="middle" className="dg-num">{i + 1}</text>
              <text x={x + 40} y={y + 29} className="dg-title">{s.title}</text>
              {s.sub.map((line, j) => (
                <text key={j} x={x + 12} y={y + 58 + j * 16} className="dg-sub dg-sub-s">{line}</text>
              ))}
              {i < n - 1 && <line x1={x + bw + 4} y1={y + bh / 2} x2={x + bw + gap - 5} y2={y + bh / 2} className="dg-line" markerEnd="url(#lc-h)" />}
            </g>
          );
        })}
      </Svg>
      <Svg w={VW} h={n * vh + (n - 1) * vgap + 2} label={label} className="dg-narrow">
        <defs><Arrow id="lc-v" /></defs>
        {LIFECYCLE_STEPS.map((s, i) => {
          const y0 = 1 + i * (vh + vgap);
          const key = i === 2;
          return (
            <g key={s.title}>
              <rect x="1" y={y0} width={VW - 2} height={vh} rx="12" className={key ? "dg-box dg-key" : "dg-box"} />
              <circle cx="26" cy={y0 + vh / 2} r="11" className={key ? "dg-dot dg-dot-key" : "dg-dot"} />
              <text x="26" y={y0 + vh / 2 + 4} textAnchor="middle" className="dg-num">{i + 1}</text>
              <text x="48" y={y0 + 24} className="dg-title">{s.title}</text>
              <text x="48" y={y0 + 43} className="dg-sub">{s.sub.join(" ")}</text>
              {i < n - 1 && <line x1={VW / 2} y1={y0 + vh + 3} x2={VW / 2} y2={y0 + vh + vgap - 4} className="dg-line" markerEnd="url(#lc-v)" />}
            </g>
          );
        })}
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

const DRAW: Record<DiagramName, () => ReactNode> = { lifecycle: Lifecycle, states: States, architecture: Architecture };

const CAPTION: Record<DiagramName, string> = {
  lifecycle: "From a raise to an exit. Everything after the raise is enforced by the vault.",
  states: "The six states of a covenant. FAILED and WIND_DOWN are final.",
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
