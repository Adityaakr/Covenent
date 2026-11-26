/* Story Mark icons from the template's "Phosphor" icon set (omX0gWFPqDwhaiWwf6ab), exported from the
   icon modules the Stories CMS items reference. 24px viewBox, stroke only (alpha 0), stroke width 2 as the
   Story Mark / Featured Mark instances set it. Colour is currentColor (Text Primary where used).
   Default size 18px (Story Mark); consumers resize with CSS on the svg (Featured 20px, detail 24px). */
type MarkKind = "circle" | "triangle" | "hexagon" | "sun" | "diamond" | "tree";

const sw = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const paths: Record<MarkKind, { d: string; t: string }[]> = {
  circle: [
    { d: "M 0 9 C 0 4.029 4.029 0 9 0 C 13.971 0 18 4.029 18 9 C 18 13.971 13.971 18 9 18 C 4.029 18 0 13.971 0 9 Z", t: "translate(3 3)" },
  ],
  triangle: [
    {
      d: "M 11.1 0.771 L 19.299 15.008 C 19.874 16.012 19.131 17.25 17.948 17.25 L 1.549 17.25 C 0.366 17.25 -0.376 16.012 0.198 15.008 L 8.398 0.771 C 8.988 -0.257 10.509 -0.257 11.1 0.771 Z",
      t: "translate(2.251 3)",
    },
  ],
  hexagon: [
    {
      d: "M 9.36 0.092 L 17.61 4.609 C 17.85 4.74 17.999 4.992 18 5.265 L 18 14.231 C 17.999 14.505 17.85 14.756 17.61 14.888 L 9.36 19.405 C 9.136 19.527 8.864 19.527 8.64 19.405 L 0.39 14.888 C 0.15 14.756 0.001 14.505 0 14.231 L 0 5.265 C 0.001 4.992 0.15 4.74 0.39 4.609 L 8.64 0.092 C 8.864 -0.031 9.136 -0.031 9.36 0.092 Z",
      t: "translate(3 2.252)",
    },
  ],
  sun: [
    { d: "M 0 2.25 L 0 0", t: "translate(12 1.5)" },
    { d: "M 0 5.25 C 0 2.351 2.351 0 5.25 0 C 8.149 0 10.5 2.351 10.5 5.25 C 10.5 8.149 8.149 10.5 5.25 10.5 C 2.351 10.5 0 8.149 0 5.25 Z", t: "translate(6.75 6.75)" },
    { d: "M 1.5 1.5 L 0 0", t: "translate(4.5 4.5)" },
    { d: "M 1.5 0 L 0 1.5", t: "translate(4.5 18)" },
    { d: "M 0 1.5 L 1.5 0", t: "translate(18 4.5)" },
    { d: "M 0 0 L 1.5 1.5", t: "translate(18 18)" },
    { d: "M 2.25 0 L 0 0", t: "translate(1.5 12)" },
    { d: "M 0 0 L 0 2.25", t: "translate(12 20.25)" },
    { d: "M 0 0 L 2.25 0", t: "translate(20.25 12)" },
  ],
  diamond: [
    {
      d: "M 10.277 19.281 C 9.986 19.572 9.514 19.572 9.223 19.281 L 0.218 10.277 C -0.073 9.986 -0.073 9.514 0.218 9.223 L 9.223 0.218 C 9.514 -0.073 9.986 -0.073 10.277 0.218 L 19.281 9.223 C 19.572 9.514 19.572 9.986 19.281 10.277 Z",
      t: "translate(2.25 2.25)",
    },
  ],
  tree: [
    { d: "M 0 13.5 L 0 0", t: "translate(12 8.25)" },
    { d: "M 4.5 2.25 L 0 0", t: "translate(7.5 12)" },
    { d: "M 0 2.25 L 4.5 0", t: "translate(12 9.75)" },
    {
      d: "M 9.75 14.44 C 10.855 15.326 12.239 15.792 13.656 15.752 C 16.837 15.672 19.508 12.919 19.5 9.737 C 19.493 7.294 18.005 5.098 15.738 4.187 C 14.819 1.673 12.427 0 9.75 0 C 7.073 0 4.681 1.673 3.762 4.187 C 1.494 5.099 0.005 7.296 0 9.741 C -0.008 12.923 2.664 15.675 5.845 15.756 C 7.262 15.794 8.646 15.328 9.75 14.44 Z",
      t: "translate(2.25 2.242)",
    },
  ],
};

export function Mark({ kind, size = 18, className }: { kind: MarkKind; size?: number; className?: string }) {
  return (
    <svg className={className} data-mark={kind} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      {paths[kind].map((p, i) => (
        <path key={i} d={p.d} transform={p.t} {...sw} />
      ))}
    </svg>
  );
}

/* Arrow Right / Arrow Left as the live template renders them: Framer's Phosphor vectors stroke the arrow head as a
   closed triangle (path "M 0 0 L 6.75 6.75 L 0 13.5 Z" at translate(13.5 5.25)) plus a 9.75px shaft, 24 viewBox,
   stroke 1.5, round caps and joins. Read from the published site's SVG symbols. */
const ARROW_RIGHT = "M3.75 12H13.5M13.5 5.25L20.25 12L13.5 18.75Z";
const ARROW_LEFT = "M20.25 12H10.5M10.5 5.25L3.75 12L10.5 18.75Z";
/* Phosphor (regular) strokes for the template's Quotes icon, 256 viewBox.
   strokeWidth is given in 24px units (1.5 like the instances) and scaled to the 256 box. */
const k = 256 / 24;
export function ArrowRight({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <path d={ARROW_RIGHT} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ArrowLeft({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <path d={ARROW_LEFT} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Quotes({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" style={{ flex: "none" }}>
      <path
        d="M108 144H40a8 8 0 0 1-8-8V72a8 8 0 0 1 8-8h60a8 8 0 0 1 8 8v88a40 40 0 0 1-40 40M224 144h-68a8 8 0 0 1-8-8V72a8 8 0 0 1 8-8h60a8 8 0 0 1 8 8v88a40 40 0 0 1-40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5 * k}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
