import { Fragment, type CSSProperties, type ReactNode } from "react";

/*
 * The BNB Chain mark in the product app. It reuses the landing's own logo file, public/landing/logos/bnb-chain.svg
 * (the official mark via Simple Icons, CC0; see that folder's SOURCES.md), as a CSS mask, so the app carries no copy
 * of the path and can colour the mark: brand yellow by default, the text colour where a section is monochrome.
 * Sized to the cap height of the surrounding text, on the baseline, and kept on one line with the word after it.
 */
const SRC = "/landing/logos/bnb-chain.svg";
export const BNB_YELLOW = "#F0B90B";
const mask = (size: string): CSSProperties => ({ WebkitMask: `url(${SRC}) center / contain no-repeat`, mask: `url(${SRC}) center / contain no-repeat`, width: size, height: size });

export function BnbMark({ mono = false, style, title }: { mono?: boolean; style?: CSSProperties; title?: string }) {
  return (
    <span role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={{ display: "inline-block", ...mask("0.76em"), width: "0.66em", verticalAlign: "baseline", marginRight: "0.26em", flex: "none", background: mono ? "currentColor" : BNB_YELLOW, ...style }} />
  );
}

/** "BNB Chain" (or another label) with the mark before it, never split across lines. */
export function BnbChain({ children = "BNB Chain", mono }: { children?: ReactNode; mono?: boolean }) {
  return <span style={{ whiteSpace: "nowrap" }}><BnbMark mono={mono} />{children}</span>;
}

/** The mark before every "BNB Chain" and standalone "BNB" in a string (not "BNB/USD" or "WBNB"). */
export function withBnb(text: string, mono?: boolean): ReactNode {
  const parts = text.split(/(\bBNB[\s ]Chain\b|\bBNB\b(?![/\w]))/);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <BnbChain key={i} mono={mono}>{p}</BnbChain> : <Fragment key={i}>{p}</Fragment>));
}

/*
 * The coin is an inline-block whose only child is absolutely placed, so it has no line box and its baseline is its
 * bottom edge (an inline-grid with an empty child synthesises a baseline inside the box instead, which dropped the
 * coin below the text). vertical-align then lifts that bottom edge so the coin's centre sits at half the cap height
 * (Inter and the display face are about 0.7em) of the text around it: optically centred on "BNB" and on the digits,
 * at any size. Inside a flex row vertical-align is ignored and the row's own alignment applies.
 */
const CAP_MID = "0.35em";
const px = (v: string | number) => (typeof v === "number" ? `${v}px` : v);

/** The BNB token glyph for amounts: the mark on a brand-yellow coin, like a wallet's token icon. */
export function BnbCoin({ size = "1em", style, title = "BNB" }: { size?: string | number; style?: CSSProperties; title?: string }) {
  const s = px(size);
  return (
    <span role="img" aria-label={title} style={{ position: "relative", display: "inline-block", width: s, height: s, borderRadius: "50%", background: `radial-gradient(120% 120% at 30% 20%, #ffd54a, ${BNB_YELLOW} 55%, #d99c00)`, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)", verticalAlign: `calc(${CAP_MID} - ${s} / 2)`, flex: "none", ...style }}>
      <span aria-hidden style={{ position: "absolute", inset: "21%", ...mask("58%"), background: "#fff" }} />
    </span>
  );
}
