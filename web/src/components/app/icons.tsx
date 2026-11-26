import type { CSSProperties } from "react";

/* A small stroke icon set in the template's style: 1.5px strokes, rounded joins, 20px grid. */
const PATHS = {
  home: "M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1Z",
  grid: "M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z",
  plus: "M10 4v12M4 10h12",
  sheet: "M5.5 3.5h6l3 3v10h-9zM11.5 3.5v3h3M8 10h4.5M8 13h4.5",
  chart: "M4 16V4M4 16h12M7 12l3-3 2.5 2L16 7",
  play: "M6.5 4.5v11l9-5.5z",
  flask: "M8 3.5h4M8.5 3.5v5L4.5 15a1.2 1.2 0 0 0 1 1.8h9a1.2 1.2 0 0 0 1-1.8l-4-6.5v-5",
  team: "M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 16c.4-2.6 2.2-4 4.5-4s4.1 1.4 4.5 4M13 4.8a2.4 2.4 0 0 1 0 4.4M14.5 12.2c1.5.4 2.6 1.7 3 3.8",
  redeem: "M4 7h10l-3-3M16 13H6l3 3",
  coins: "M7.5 8.5c2.5 0 4.5-.9 4.5-2s-2-2-4.5-2-4.5.9-4.5 2 2 2 4.5 2ZM3 6.5v7c0 1.1 2 2 4.5 2M12 6.5V9M8 12c0 1.1 2 2 4.5 2s4.5-.9 4.5-2-2-2-4.5-2S8 10.9 8 12Zm0 0v2.5c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V12",
  search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM17 17l-3.7-3.7",
  sun: "M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1",
  moon: "M16.5 11.8A6.8 6.8 0 0 1 8.2 3.5a6.8 6.8 0 1 0 8.3 8.3Z",
  wallet: "M3.5 6.5h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1zM3.5 6.5l9-3v3M13.5 11.5h.01",
  copy: "M7 7h9v9H7zM4 13V4h9",
  check: "M4.5 10.5l3.5 3.5 7.5-8",
  x: "M5 5l10 10M15 5 5 15",
  info: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 9.5V14M10 6.5h.01",
  alert: "M10 3.5 17.5 16.5h-15zM10 8.5v3.5M10 14.5h.01",
  shield: "M10 3 4.5 5v4.5c0 3.6 2.4 6.4 5.5 7.5 3.1-1.1 5.5-3.9 5.5-7.5V5z",
  bolt: "M11 2.5 4.5 11H10l-1 6.5L15.5 9H10z",
  clock: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 6v4l2.5 2",
  lock: "M5.5 9h9v7.5h-9zM7.5 9V6.5a2.5 2.5 0 0 1 5 0V9",
  unlock: "M5.5 9h9v7.5h-9zM7.5 9V6.5a2.5 2.5 0 0 1 4.9-.7",
  heart: "M10 16.5S3.5 12.6 3.5 8a3.2 3.2 0 0 1 6.5-1.2A3.2 3.2 0 0 1 16.5 8c0 4.6-6.5 8.5-6.5 8.5Z",
  doc: "M5.5 3.5h9v13h-9zM8 7h4M8 10h4M8 13h2.5",
  exit: "M8 4H4.5v12H8M12.5 6.5 16 10l-3.5 3.5M16 10H8",
  agent: "M6 7.5h8a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 14V9A1.5 1.5 0 0 1 6 7.5ZM10 4.5v3M8 11h.01M12 11h.01M2.5 11v2M17.5 11v2",
  user: "M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.5 16.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5",
  menu: "M3.5 6h13M3.5 10h13M3.5 14h13",
  arrow: "M4 10h12M11 5l5 5-5 5",
  back: "M16 10H4M9 5l-5 5 5 5",
  ext: "M8 4.5H4.5v11h11V12M11 4.5h4.5V9M15.5 4.5 9 11",
  refresh: "M16 5v3.5h-3.5M4 15v-3.5h3.5M15.3 8.5A5.8 5.8 0 0 0 5 7M4.7 11.5A5.8 5.8 0 0 0 15 13",
  pulse: "M2.5 10h3l2-4.5 3.5 9 2-4.5h4.5",
  link: "M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.8.8M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.8-.8",
  sparkle: "M10 3v3M10 14v3M3 10h3M14 10h3M5 5l2 2M13 13l2 2M5 15l2-2M13 7l2-2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, style, className }: { name: IconName; size?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style} className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Mark({ size = 14 }: { size?: number }) {
  // Covenant's mark: a vault door, a ring with a bar through it.
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 2.8v10.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
