import { SiteLayout } from "../components/SiteLayout";
import { PageCTA } from "../components/PageCTA";
import { ChangelogHero } from "../sections/changelog/ChangelogHero";
import { ChangelogList } from "../sections/changelog/ChangelogList";
import { pageCta } from "../sections/changelog/pageCta";

/** /changelog (Framer page M3aXaoeK3): Changelog Hero, Changelog List Section, Page CTA. */
export function ChangelogPage() {
  return (
    <SiteLayout current="/changelog">
      <ChangelogHero />
      <ChangelogList />
      <PageCTA {...pageCta} />
    </SiteLayout>
  );
}
