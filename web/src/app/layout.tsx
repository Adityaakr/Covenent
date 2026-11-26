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
  themeColor: "#ffffff",
};

/**
 * Runs before first paint: the visitor's saved theme on <html data-theme>, else dark (the app's default; the landing
 * page keeps its own light palette whatever this says), so a page never flashes the wrong theme. Storage can throw
 * in private windows.
 */
const THEME_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem("theme")}catch(e){}document.documentElement.dataset.theme=t==="light"?"light":"dark"})();`;

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
