import { SiteLayout } from "../components/SiteLayout";
import { PageCTA } from "../components/PageCTA";
import { milestones } from "../content/milestones";
import { findMilestone } from "../sections/changelog/data";
import { EntryHeader } from "../sections/changelog/EntryHeader";
import { EntryCover } from "../sections/changelog/EntryCover";
import { EntryBody } from "../sections/changelog/EntryBody";
import { pageCta } from "../sections/changelog/pageCta";
import { NotFoundPage } from "./NotFoundPage";

/** Every milestone slug, for static generation of /changelog/[slug]. */
export const changelogSlugs: string[] = milestones.map((m) => m.slug);

/** /changelog/[slug] (Framer entry detail page e861ZTNWV): header, cover, rich text body + subscribe card, Page CTA. */
export function ChangelogEntryPage({ slug }: { slug: string }) {
  const m = findMilestone(slug);
  if (!m) return <NotFoundPage />;
  return (
    <SiteLayout current={`/changelog/${m.slug}`}>
      <EntryHeader m={m} />
      <EntryCover m={m} />
      <EntryBody m={m} />
      <PageCTA {...pageCta} />
    </SiteLayout>
  );
}
