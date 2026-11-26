import type { ReactNode } from "react";
import "../styles/landing.css";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { PageTransition } from "./PageTransition";

/** Layout template "Main" (bjIxcK_F0): Background fill, vertical stack centred, clip.
 *  Navigation (sticky top 0, z 5) + page + Footer. The template's Template Dock is not part of the site. */
export function SiteLayout({ current, children }: { current?: string; children?: ReactNode }) {
  return (
    <div className="landing-root">
      <Navigation current={current} />
      <PageTransition>{children}</PageTransition>
      <Footer current={current} />
    </div>
  );
}
