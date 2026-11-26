/*
 * Covenant landing: a code copy of the Framer template "Ondrel" with Covenant content (docs/landing/).
 * Default export renders "/". Every other page has a default export in ./pages for the app router:
 *   /features            ./pages/features          /contact             ./pages/contact
 *   /use-cases           ./pages/use-cases         /use-cases/[slug]    ./pages/use-case        (+ generateStaticParams)
 *   not-found.tsx        ./pages/not-found
 * Retired, kept only because routes re-export them: ./pages/pricing, ./pages/changelog and ./pages/changelog-entry
 * redirect to "/" for good (delete app/pricing and app/changelog to drop them entirely).
 */
import { Landing } from "./pages/Landing";

export default Landing;
/** Home page metadata and Open Graph: re-export from app/page.tsx (`export { default, metadata } from "@/landing"`). */
export { homeMetadata as metadata } from "./meta";
export { SITE_HEADLINE, SITE_SUBLINE, SITE_TITLE, pageMetadata } from "./meta";
export { Landing };
export { FeaturesPage } from "./pages/FeaturesPage";
export { UseCasesPage } from "./pages/UseCasesPage";
export { UseCasePage, useCaseSlugs } from "./pages/UseCasePage";
export { ContactPage } from "./pages/ContactPage";
export { NotFoundPage } from "./pages/NotFoundPage";
