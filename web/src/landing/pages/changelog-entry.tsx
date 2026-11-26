import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

/* /changelog/[slug] is retired with /changelog. The route still re-exports these, so every entry redirects home. */
export function generateStaticParams() {
  return [] as { slug: string }[];
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Covenant", robots: { index: false } };
}

export default function Page() {
  permanentRedirect("/");
}
