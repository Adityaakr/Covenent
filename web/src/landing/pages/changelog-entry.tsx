import { ChangelogEntryPage, changelogSlugs } from "./ChangelogEntryPage";

export function generateStaticParams() {
  return changelogSlugs.map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ChangelogEntryPage slug={slug} />;
}
