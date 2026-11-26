import type { CSSProperties } from "react";

/*
 * The test stablecoin's glyph: Tether's mark (public/landing/logos/tether.svg, Simple Icons, CC0; see SOURCES.md)
 * in white on a Tether-green coin, like a wallet's USDT icon. The token itself is the app's open-faucet test token on
 * BNB testnet (deployments/97.json demoUsdc), labelled USDT with a Testnet tag; it is not Tether's USDT.
 * Same geometry and alignment as BnbCoin: an inline-block whose baseline is its bottom edge, lifted so its centre
 * sits at half the cap height of the text around it.
 */
const SRC = "/landing/logos/tether.svg";
export const USDT_GREEN = "#26A17B";
/** What the app calls the test stablecoin. The contract and its address are unchanged. */
export const STABLE = { symbol: "USDT", name: "Test USDT", tag: "Testnet" } as const;

const px = (v: string | number) => (typeof v === "number" ? `${v}px` : v);
const mask: CSSProperties = { WebkitMask: `url(${SRC}) center / contain no-repeat`, mask: `url(${SRC}) center / contain no-repeat` };

export function UsdtCoin({ size = "1em", style, title = STABLE.name }: { size?: string | number; style?: CSSProperties; title?: string }) {
  const s = px(size);
  return (
    <span role="img" aria-label={title} style={{ position: "relative", display: "inline-block", width: s, height: s, borderRadius: "50%", background: `radial-gradient(120% 120% at 30% 20%, #3cc49a, ${USDT_GREEN} 55%, #1b7a5c)`, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)", verticalAlign: `calc(0.35em - ${s} / 2)`, flex: "none", ...style }}>
      <span aria-hidden style={{ position: "absolute", inset: "19%", ...mask, background: "#fff" }} />
    </span>
  );
}

/** The small "Testnet" tag after a USDT label, so a test token is never mistaken for Tether's. */
export function TestnetTag() {
  return <span className="tn-tag">{STABLE.tag}</span>;
}
