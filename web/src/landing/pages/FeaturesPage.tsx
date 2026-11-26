import { SiteLayout } from "../components/SiteLayout";
import { PageCTA } from "../components/PageCTA";
import { FeaturesHero } from "../sections/features/FeaturesHero";
import { BoardShowcase } from "../sections/features/BoardShowcase";
import { Capabilities } from "../sections/features/Capabilities";
import { ExitTimeline } from "../sections/features/ExitTimeline";
import { Integrations } from "../sections/features/Integrations";
import { TrustAssumptions } from "../sections/features/TrustAssumptions";

/* Framer page /features (O4jNLwO0Z), rebuilt with Covenant content: the five rules and the agent layer. */
export function FeaturesPage() {
  return (
    <SiteLayout current="/features">
      <FeaturesHero />
      <BoardShowcase />
      <Capabilities />
      <ExitTimeline />
      <Integrations />
      <TrustAssumptions />
      <PageCTA
        heading="Raise under rules. Exit at book."
        body="Five rules hold the treasury. Nobody has to trust the team."
        secondary={{ label: "See use cases", href: "/use-cases" }}
        primary={{ label: "Launch app", href: "/app" }}
      />
    </SiteLayout>
  );
}
