import type { CSSProperties } from "react";

/*
 * The token glyph for Demo USDC (dUSDC): a USD-blue coin with a dollar sign. It is a neutral glyph, not Circle's
 * mark, because dUSDC is a worthless test token and not USDC. Same geometry and alignment as BnbCoin: an
 * inline-block whose baseline is its bottom edge, lifted so its centre sits at half the cap height of the text.
 */
const px = (v: string | number) => (typeof v === "number" ? `${v}px` : v);

export function UsdcCoin({ size = "1em", style, title = "Demo USDC" }: { size?: string | number; style?: CSSProperties; title?: string }) {
  const s = px(size);
  return (
    <span role="img" aria-label={title} style={{ position: "relative", display: "inline-block", width: s, height: s, borderRadius: "50%", background: "radial-gradient(120% 120% at 30% 20%, #5b9cf0, #2775ca 55%, #1a5aa6)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)", verticalAlign: `calc(0.35em - ${s} / 2)`, flex: "none", ...style }}>
      <svg aria-hidden viewBox="0 0 24 24" style={{ position: "absolute", inset: "20%", width: "60%", height: "60%" }} fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18M16.5 7.5c-.7-1.3-2.4-2-4.5-2-2.6 0-4.5 1.3-4.5 3.2 0 4.3 9 2.3 9 6.6 0 1.9-1.9 3.2-4.5 3.2-2.2 0-3.9-.8-4.6-2.2" />
      </svg>
    </span>
  );
}
