/*
 * Procedural bot avatars: one deterministic little robot per seed (a token or wallet address), drawn as inline SVG
 * so it stays crisp from 20 to 100 px and needs no network. Every part is picked from the seed's hash: hue, head
 * shape, visor, eyes, antenna and ears. Shapes are thick enough to read at 20 px; colours work on light and dark.
 */

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** A hue for a seed, kept out of the warning reds so an identity never reads as a status. */
export function seedHue(seed: string): number {
  const h = hash(seed.toLowerCase()) % 300;
  return (h + 200) % 360 > 345 || (h + 200) % 360 < 15 ? (h + 230) % 360 : (h + 200) % 360;
}

export interface BotParts { hue: number; head: number; eyes: number; antenna: number; ears: boolean; mouth: number }

export function botParts(seed: string): BotParts {
  const h = hash(seed.toLowerCase());
  return {
    hue: seedHue(seed),
    head: (h >>> 3) % 4,
    eyes: (h >>> 6) % 6,
    antenna: (h >>> 9) % 4,
    ears: ((h >>> 12) & 1) === 1,
    mouth: (h >>> 13) % 3,
  };
}

export function BotAvatar({ seed, size = 32, title }: { seed: string; size?: number; title?: string }) {
  const p = botParts(seed || "covenant");
  const id = `b${hash(seed).toString(36)}`;
  const c1 = `hsl(${p.hue} 82% 64%)`;
  const c2 = `hsl(${(p.hue + 38) % 360} 78% 46%)`;
  const glow = `hsl(${(p.hue + 170) % 360} 95% 72%)`;
  const face = "#0c0e13";
  // Head geometry by variant: [x, y, w, h, rx]
  const heads: [number, number, number, number, number][] = [[9, 13, 22, 18, 6], [8, 14, 24, 16, 8], [10, 12, 20, 20, 10], [9, 13, 22, 18, 3]];
  const [hx, hy, hw, hh, hr] = heads[p.head]!;
  const cx = 20, ey = hy + hh / 2 - 0.5;
  const visor = { x: hx + 3, y: hy + 3.5, w: hw - 6, h: hh - 8.5 };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false" style={{ display: "block", flex: "none" }}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe4ee" /></linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${id}g)`} />
      <ellipse cx="14" cy="9" rx="11" ry="6" fill="#fff" opacity="0.16" />
      {p.antenna === 1 ? <><rect x="19" y={hy - 6} width="2" height="6" rx="1" fill="#fff" opacity="0.9" /><circle cx="20" cy={hy - 6.5} r="2.4" fill={glow} /></> : null}
      {p.antenna === 2 ? <><rect x="13" y={hy - 4.5} width="2" height="5" rx="1" fill="#fff" opacity="0.9" transform={`rotate(-18 14 ${hy})`} /><rect x="25" y={hy - 4.5} width="2" height="5" rx="1" fill="#fff" opacity="0.9" transform={`rotate(18 26 ${hy})`} /></> : null}
      {p.antenna === 3 ? <rect x="16" y={hy - 3} width="8" height="3.5" rx="1.75" fill="#fff" opacity="0.9" /> : null}
      {p.ears ? <><rect x={hx - 3} y={ey - 3} width="3.5" height="7" rx="1.5" fill="#fff" opacity="0.85" /><rect x={hx + hw - 0.5} y={ey - 3} width="3.5" height="7" rx="1.5" fill="#fff" opacity="0.85" /></> : null}
      <rect x={hx} y={hy} width={hw} height={hh} rx={hr} fill={`url(#${id}h)`} />
      <rect x={visor.x} y={visor.y} width={visor.w} height={visor.h} rx={Math.min(hr - 1, visor.h / 2)} fill={face} />
      {p.eyes === 0 ? <><circle cx={cx - 4.5} cy={ey} r="2.2" fill={glow} /><circle cx={cx + 4.5} cy={ey} r="2.2" fill={glow} /></> : null}
      {p.eyes === 1 ? <rect x={cx - 7} y={ey - 1.4} width="14" height="2.8" rx="1.4" fill={glow} /> : null}
      {p.eyes === 2 ? <><rect x={cx - 6.5} y={ey - 2.6} width="3" height="5.2" rx="1.5" fill={glow} /><rect x={cx + 3.5} y={ey - 2.6} width="3" height="5.2" rx="1.5" fill={glow} /></> : null}
      {p.eyes === 3 ? <><circle cx={cx} cy={ey} r="3.2" fill={glow} /><circle cx={cx + 1} cy={ey - 1} r="1" fill="#fff" /></> : null}
      {p.eyes === 4 ? <><path d={`M${cx - 7} ${ey + 1.4} q2.5 -4 5 0`} stroke={glow} strokeWidth="2" fill="none" strokeLinecap="round" /><path d={`M${cx + 2} ${ey + 1.4} q2.5 -4 5 0`} stroke={glow} strokeWidth="2" fill="none" strokeLinecap="round" /></> : null}
      {p.eyes === 5 ? <><rect x={cx - 7} y={ey - 2} width="5" height="4" rx="1" fill={glow} /><rect x={cx + 2} y={ey - 2} width="5" height="4" rx="1" fill={glow} /></> : null}
      {p.mouth === 1 ? <rect x={cx - 3} y={hy + hh - 3.6} width="6" height="1.6" rx="0.8" fill={c2} opacity="0.9" /> : null}
      {p.mouth === 2 ? <><circle cx={cx - 3} cy={hy + hh - 2.8} r="0.9" fill={c2} /><circle cx={cx} cy={hy + hh - 2.8} r="0.9" fill={c2} /><circle cx={cx + 3} cy={hy + hh - 2.8} r="0.9" fill={c2} /></> : null}
    </svg>
  );
}
