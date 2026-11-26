import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { milestones } from "../content/milestones";
import { ChangelogEntryPage, changelogSlugs } from "./ChangelogEntryPage";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return changelogSlugs.map((slug) => ({ slug }));
}

/** Re-export from the route file (`export { default, generateStaticParams, generateMetadata } from ...`). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = milestones.find((x) => x.slug === slug);
  return item ? { title: item.title, description: item.summary } : {};
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  // An unknown slug is a real 404 (status and the app's not-found page), not a 200 with the 404 layout.
  if (!changelogSlugs.includes(slug)) notFound();
  return <ChangelogEntryPage slug={slug} />;
}
