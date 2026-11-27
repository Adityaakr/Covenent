import type { HowIcon } from "../../content/integrations";

/* Tiny line glyphs for the "how" steps in "How it's built": 24px grid, 1.6 stroke, currentColor, drawn for this
   section (no icon library on the landing). Decorative: the step text says what each one means. */
const PATHS: Record<HowIcon, string[]> = {
  launch: ["M5 19l4-1 9-9a2.8 2.8 0 0 0-4-4l-9 9-1 4z", "M13 6l5 5", "M4 20l2-2"],
  pool: ["M12 3.5c3 3.6 5.5 6.6 5.5 9.6a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-9.6z", "M9.5 14a2.5 2.5 0 0 0 2.5 2.5"],
  vault: ["M4 5.5h16v13H4z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z", "M12 9v-.5M7 18.5V20M17 18.5V20"],
  chart: ["M4 4v16h16", "M7.5 15l3.5-4 3 2.5 4.5-6"],
  shield: ["M12 3.5l7 2.6v5.4c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6.1z", "M9 12l2.2 2.2L15.5 10"],
  feed: ["M5 19a1 1 0 1 0 0-.01", "M4.5 12.5a7 7 0 0 1 7 7", "M4.5 6.5a13 13 0 0 1 13 13"],
  sign: ["M4 17.5c2-3 3.5-3 4.5-1.5s2 1.5 3.5-.5 2.5-1.5 3.5 0", "M14 4.5l5.5 5.5-6 6H8v-5.5z"],
  id: ["M3.5 6h17v12h-17z", "M10 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0z", "M5.5 15.5c.6-1.2 1.6-1.8 2.5-1.8s1.9.6 2.5 1.8", "M13.5 10h4M13.5 13.5h3"],
  pen: ["M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z", "M13.5 7l3 3"],
  api: ["M8.5 8l-4 4 4 4", "M15.5 8l4 4-4 4", "M13.5 6l-3 12"],
  bell: ["M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z", "M10 20.5a2 2 0 0 0 4 0"],
  split: ["M6 4v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v3", "M6 4v16", "M15.5 17.5L18 20l2.5-2.5"],
  lock: ["M5.5 10.5h13v9.5h-13z", "M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5", "M12 14.5v2"],
  clock: ["M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z", "M12 7.5V12l3 2"],
  code: ["M8.5 8l-4 4 4 4", "M15.5 8l4 4-4 4"],
  check: ["M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z", "M8.5 12.2l2.4 2.3 4.6-4.8"],
  people: ["M12 9.5a3 3 0 1 0 0-.01", "M6.5 19c.8-2.8 2.9-4.3 5.5-4.3s4.7 1.5 5.5 4.3", "M5 11a2 2 0 1 0 0-.01M19 11a2 2 0 1 0 0-.01"],
};

export function HowGlyph({ name, size = 16 }: { name: HowIcon; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{ flex: "none" }}>
      {PATHS[name].map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
