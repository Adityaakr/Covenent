import type { Metadata, Viewport } from "next";
import "./globals.css";
import { inter, interDisplay, mono } from "./fonts";

export const metadata: Metadata = {
  title: { default: "Covenant: investor protections that enforce themselves", template: "%s · Covenant" },
  description: "A Flap Pool Launch launcher and vault on BNB Chain. Five rules bind a team or an AI agent after a token raise: tap, performance unlock, book-value exit, abandonment switch, disclosure.",
  applicationName: "Covenant",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" }],
};

/**
 * Runs before first paint: the visitor's saved theme, else the system's, on <html data-theme>, so a dark page never
 * flashes light. With no saved choice it follows the system as it changes. Storage can throw in private windows.
 */
const THEME_SCRIPT = `(function(){var d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");function saved(){try{var t=localStorage.getItem("theme");return t==="dark"||t==="light"?t:null}catch(e){return null}}function apply(){d.dataset.theme=saved()||(m.matches?"dark":"light")}apply();m.addEventListener("change",function(){if(!saved())apply()})})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interDisplay.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
