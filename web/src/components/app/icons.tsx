import type { CSSProperties } from "react";

/* Line icons in the landing template's Phosphor style: 1.5px strokes, round caps and joins, on a 20px grid. */
const PATHS = {
  home: "M3.5 9.5 10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1Z",
  compass: "M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM12.9 7.1l-1.6 4.2-4.2 1.6 1.6-4.2z",
  grid: "M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z",
  layers: "M10 3 2.5 7 10 11l7.5-4zM2.5 10 10 14l7.5-4M2.5 13 10 17l7.5-4",
  pie: "M10 2.5v7.5h7.5A7.5 7.5 0 1 1 10 2.5ZM12.5 2.9A7.5 7.5 0 0 1 17.1 7.5h-4.6z",
  plus: "M10 4v12M4 10h12",
  rocket: "M11.5 15.5 9 18v-3.5M4.5 11 2 8.5h3.5M8 13l-1-1a8 8 0 0 1 9.5-9.5A8 8 0 0 1 8 12ZM12.5 8.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM6 14c-1.2.4-2 1.6-2 3 1.4 0 2.6-.8 3-2",
  sheet: "M5.5 3.5h6l3 3v10h-9zM11.5 3.5v3h3M8 10h4.5M8 13h4.5",
  chart: "M4 16V4M4 16h12M7 12l3-3 2.5 2L16 7",
  trend: "M2.5 14.5 7.5 9.5l3 3 7-7M12.5 5.5h5v5",
  trendDown: "M2.5 5.5 7.5 10.5l3-3 7 7M12.5 14.5h5v-5",
  play: "M6.5 4.5v11l9-5.5z",
  flask: "M8 3.5h4M8.5 3.5v5L4.5 15a1.2 1.2 0 0 0 1 1.8h9a1.2 1.2 0 0 0 1-1.8l-4-6.5v-5",
  team: "M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 16c.4-2.6 2.2-4 4.5-4s4.1 1.4 4.5 4M13 4.8a2.4 2.4 0 0 1 0 4.4M14.5 12.2c1.5.4 2.6 1.7 3 3.8",
  redeem: "M4 7h10l-3-3M16 13H6l3 3",
  swap: "M14 3.5 16.5 6 14 8.5M16.5 6h-11M6 11.5 3.5 14 6 16.5M3.5 14h11",
  coins: "M7.5 8.5c2.5 0 4.5-.9 4.5-2s-2-2-4.5-2-4.5.9-4.5 2 2 2 4.5 2ZM3 6.5v7c0 1.1 2 2 4.5 2M12 6.5V9M8 12c0 1.1 2 2 4.5 2s4.5-.9 4.5-2-2-2-4.5-2S8 10.9 8 12Zm0 0v2.5c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V12",
  vault: "M3.5 4.5h13v11h-13zM6 15.5V17M14 15.5V17M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10 7.5v-1M12.5 10h1",
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
  shieldCheck: "M10 3 4.5 5v4.5c0 3.6 2.4 6.4 5.5 7.5 3.1-1.1 5.5-3.9 5.5-7.5V5zM7.5 10l1.8 1.8 3.2-3.6",
  bolt: "M11 2.5 4.5 11H10l-1 6.5L15.5 9H10z",
  clock: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 6v4l2.5 2",
  lock: "M5.5 9h9v7.5h-9zM7.5 9V6.5a2.5 2.5 0 0 1 5 0V9",
  unlock: "M5.5 9h9v7.5h-9zM7.5 9V6.5a2.5 2.5 0 0 1 4.9-.7",
  heart: "M10 16.5S3.5 12.6 3.5 8a3.2 3.2 0 0 1 6.5-1.2A3.2 3.2 0 0 1 16.5 8c0 4.6-6.5 8.5-6.5 8.5Z",
  doc: "M5.5 3.5h9v13h-9zM8 7h4M8 10h4M8 13h2.5",
  book: "M10 5.5c-1.5-1.3-3.5-2-6.5-2v11c3 0 5 .7 6.5 2 1.5-1.3 3.5-2 6.5-2v-11c-3 0-5 .7-6.5 2Zm0 0v11",
  exit: "M8 4H4.5v12H8M12.5 6.5 16 10l-3.5 3.5M16 10H8",
  agent: "M6 7.5h8a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 14V9A1.5 1.5 0 0 1 6 7.5ZM10 4.5v3M8 11h.01M12 11h.01M2.5 11v2M17.5 11v2",
  user: "M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4.5 16.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5",
  users: "M7.5 9a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5ZM2.5 16c.5-2.8 2.4-4.3 5-4.3s4.5 1.5 5 4.3M13 3.7a2.75 2.75 0 0 1 0 5.1M14.8 11.9c1.4.6 2.4 2 2.7 4.1",
  chat: "M4 4.5h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-3.5 3v-3H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
  send: "M17 3 9 11M17 3l-5 14-3-6-6-3z",
  menu: "M3.5 6h13M3.5 10h13M3.5 14h13",
  sidebar: "M3.5 4.5h13v11h-13zM8 4.5v11",
  arrow: "M4 10h12M11 5l5 5-5 5",
  back: "M16 10H4M9 5l-5 5 5 5",
  up: "M10 16V4M5 9l5-5 5 5",
  down: "M10 4v12M5 11l5 5 5-5",
  chevronDown: "M5.5 8 10 12.5 14.5 8",
  chevronRight: "M8 5.5 12.5 10 8 14.5",
  chevronLeft: "M12 5.5 7.5 10l4.5 4.5",
  ext: "M8 4.5H4.5v11h11V12M11 4.5h4.5V9M15.5 4.5 9 11",
  arrowUpRight: "M6 14 14 6M7 6h7v7",
  refresh: "M16 5v3.5h-3.5M4 15v-3.5h3.5M15.3 8.5A5.8 5.8 0 0 0 5 7M4.7 11.5A5.8 5.8 0 0 0 15 13",
  pulse: "M2.5 10h3l2-4.5 3.5 9 2-4.5h4.5",
  activity: "M2.5 10h3l2-4.5 3.5 9 2-4.5h4.5",
  link: "M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.8.8M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.8-.8",
  sparkle: "M10 2.5c.5 3.9 2.1 6.5 6 7-3.9.5-5.5 3.1-6 7-.5-3.9-2.1-6.5-6-7 3.9-.5 5.5-3.1 6-7Z",
  globe: "M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM2.5 10h15M10 2.5c2 2 3 4.5 3 7.5s-1 5.5-3 7.5c-2-2-3-4.5-3-7.5s1-5.5 3-7.5Z",
  eye: "M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10ZM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  target: "M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM10 10h.01",
  flag: "M4.5 17V3.5M4.5 4h10l-2 3.5 2 3.5h-10",
  command: "M7 7V5.5A1.5 1.5 0 1 0 5.5 7H7Zm0 0h6m-6 0v6m6-6V5.5A1.5 1.5 0 1 1 14.5 7H13Zm0 0v6m0 0h1.5a1.5 1.5 0 1 1-1.5 1.5V13Zm0 0H7m0 0v1.5A1.5 1.5 0 1 1 5.5 13H7Z",
  dots: "M5 10h.01M10 10h.01M15 10h.01",
  sliders: "M3.5 6h8.25M15.25 6h1.25M3.5 14h1.25M8.25 14h8.25M13.5 7.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM6.5 15.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z",
  fire: "M10 17.5c3 0 5-2 5-5 0-3.5-3-5-3.5-9-2 1.5-3.5 3.5-3.5 6-1-.5-1.5-1.5-1.5-2.5C5 8.5 5 10.5 5 12.5c0 3 2 5 5 5Z",
  burn: "M10 17.5c3 0 5-2 5-5 0-3.5-3-5-3.5-9-2 1.5-3.5 3.5-3.5 6-1-.5-1.5-1.5-1.5-2.5C5 8.5 5 10.5 5 12.5c0 3 2 5 5 5Z",
  drop: "M10 2.8s-5.2 5.8-5.2 9.4a5.2 5.2 0 0 0 10.4 0c0-3.6-5.2-9.4-5.2-9.4ZM7.6 12.6a2.5 2.5 0 0 0 2.4 2.3",
  mic: "M10 12.5a2.5 2.5 0 0 0 2.5-2.5V5a2.5 2.5 0 0 0-5 0v5a2.5 2.5 0 0 0 2.5 2.5ZM5 9.5a5 5 0 0 0 10 0M10 14.5V17",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, style, className, strokeWidth = 1.5 }: { name: IconName; size?: number; style?: CSSProperties; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={style} className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The landing page's logo mark (Navigation "Logo Mark"): a rounded square with a dot in the bottom right. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden focusable="false">
      <rect width="22" height="22" rx="7" fill="var(--ink)" />
      <circle cx="14" cy="14" r="4" fill="var(--chrome)" />
    </svg>
  );
}
