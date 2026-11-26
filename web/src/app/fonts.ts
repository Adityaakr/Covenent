import localFont from "next/font/local";

/*
 * Inter for text and Inter Display for headings, matching the Framer site (rsms/inter, SIL OFL 1.1, files in
 * src/fonts). Geist Mono sets every figure. Each font exposes a CSS variable on <html>:
 *   --font-inter, --font-inter-display, --font-mono
 */
export const inter = localFont({
  src: [{ path: "../fonts/InterVariable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});

export const interDisplay = localFont({
  src: [
    { path: "../fonts/InterDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/InterDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/InterDisplay-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/InterDisplay-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter-display",
  display: "swap",
});

export const mono = localFont({
  src: [{ path: "../fonts/GeistMono-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-mono",
  display: "swap",
});
