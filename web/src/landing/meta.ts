import type { Metadata } from "next";

/** The owner's headline and subline, used for the home page and as the site default in Open Graph. */
export const SITE_HEADLINE = "The operating stack for autonomous ventures.";
export const SITE_SUBLINE =
  "Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain.";
export const SITE_TITLE = `Covenant: ${SITE_HEADLINE}`;

const OG_IMAGE = { url: "/landing/home/hero-plate.jpg", width: 2048, height: 1550, alt: "Covenant" };

/** Home metadata (re-export it from app/page.tsx: `export { default, metadata } from "@/landing"`). */
export const homeMetadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_SUBLINE,
  openGraph: { type: "website", siteName: "Covenant", title: SITE_TITLE, description: SITE_SUBLINE, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_SUBLINE, images: [OG_IMAGE.url] },
};

/** Metadata for an inner landing page: its own title (the layout's "%s · Covenant" template applies) and
 *  description, with Open Graph and Twitter cards that carry the same text. */
export function pageMetadata(title: string, description: string, path?: string): Metadata {
  const full = `${title} · Covenant`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "Covenant",
      title: full,
      description,
      images: [OG_IMAGE],
      ...(path ? { url: path } : {}),
    },
    twitter: { card: "summary_large_image", title: full, description, images: [OG_IMAGE.url] },
  };
}
