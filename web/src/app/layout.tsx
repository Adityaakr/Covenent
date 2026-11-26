import type { Metadata, Viewport } from "next";
import "./globals.css";
import { inter, interDisplay, mono } from "./fonts";

const TITLE = "Covenant: The operating stack for autonomous ventures.";
const DESCRIPTION = "Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8080"),
  title: { default: TITLE, template: "%s · Covenant" },
  description: DESCRIPTION,
  applicationName: "Covenant",
  openGraph: { type: "website", siteName: "Covenant", title: TITLE, description: DESCRIPTION, images: [{ url: "/landing/home/hero-plate.jpg", width: 2048, height: 1550, alt: "Covenant" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/landing/home/hero-plate.jpg"] },
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
