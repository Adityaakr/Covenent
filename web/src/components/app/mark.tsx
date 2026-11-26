import { useId, type CSSProperties } from "react";

/*
 * The Covenant mark (the landing's Logo Mark: a 22px rounded square with a dot cut out at the bottom right) as a
 * "thinking" loop for loading and agent work: the cut-out dot walks the square's inner corners and comes home while
 * the square breathes and a soft light sweeps across, about 2.8 s a cycle. It draws in currentColor with a true
 * hole, so it sits on any surface (buttons included). Under prefers-reduced-motion it is the still mark.
 * `calm` is the idle variant for a resting surface (Ask AI's empty state): a slow breath and the dot drifting on a
 * small orbit, about 6 s a cycle, no light sweep.
 */
export function ThinkingMark({ size = 16, label, still = false, calm = false, style }: { size?: number; label?: string; still?: boolean; calm?: boolean; style?: CSSProperties }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={still ? "tmark still" : calm ? "tmark calm" : "tmark"} width={size} height={size} viewBox="0 0 22 22" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false" style={style}>
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="22" height="22">
          <rect width="22" height="22" rx="7" fill="#fff" />
          <circle className="tmark-dot" cx="14" cy="14" r="4" fill="#000" />
        </mask>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopOpacity="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="0.5" stopOpacity="0.85" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" stopOpacity="0" style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
        <clipPath id={`c${id}`}><rect width="22" height="22" rx="7" /></clipPath>
      </defs>
      <g className="tmark-body">
        <rect width="22" height="22" fill="currentColor" mask={`url(#m${id})`} />
        <g clipPath={`url(#c${id})`} mask={`url(#m${id})`}><rect className="tmark-sweep" x="-12" y="0" width="10" height="22" fill={`url(#s${id})`} /></g>
      </g>
    </svg>
  );
}
