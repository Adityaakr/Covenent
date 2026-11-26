import { SiteLayout } from "../components/SiteLayout";
import { PageCTA } from "../components/PageCTA";
import {
  UseCasesHero,
  FeaturedUseCase,
  UseCaseStats,
  AllUseCases,
  QuoteWall,
} from "../sections/usecases/UseCasesSections";

/** /use-cases: Framer page /customers (wBmMaVIkR). */
export function UseCasesPage() {
  return (
    <SiteLayout current="/use-cases">
      <UseCasesHero />
      <FeaturedUseCase />
      <UseCaseStats />
      <AllUseCases />
      <QuoteWall />
      <PageCTA
        heading="Raise under rules. Exit at book."
        body="Five rules hold the treasury. Nobody has to trust the team."
        secondary={{ label: "Read the rules", href: "/features" }}
        primary={{ label: "Launch app", href: "/app" }}
      />
    </SiteLayout>
  );
}
