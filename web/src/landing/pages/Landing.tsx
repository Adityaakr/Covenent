import { SiteLayout } from "../components/SiteLayout";
import { HomeHero } from "../sections/home/HomeHero";
import { HomeFeatures } from "../sections/home/HomeFeatures";
import { HomeProblem } from "../sections/home/HomeProblem";
import { HomeVoices } from "../sections/home/HomeVoices";
import { HomeLifecycle } from "../sections/home/HomeLifecycle";
import { HomeAgentLayer } from "../sections/home/HomeAgentLayer";
import { HomeUseCases } from "../sections/home/HomeUseCases";
import { HomeQuote } from "../sections/home/HomeQuote";
import { HomePricing } from "../sections/home/HomePricing";
import { HomeFAQ } from "../sections/home/HomeFAQ";
import { HomeMilestones } from "../sections/home/HomeMilestones";
import { HomeClosingCTA } from "../sections/home/HomeClosingCTA";
import { Compare } from "../sections/pricing/Compare";

/* Home: the template's sections in the template's order, with four added in its own patterns: the problem today
   (from "Stats"), who named it (Quote Wall), the lifecycle (Capabilities grid) and prior art (the pricing Compare). */
export function Landing() {
  return (
    <SiteLayout current="/">
      <HomeHero />
      <HomeProblem />
      <HomeVoices />
      <HomeFeatures />
      <HomeLifecycle />
      <HomeAgentLayer />
      <HomeUseCases />
      <HomeQuote />
      <Compare
        id="compare"
        eyebrow="Prior art"
        first="Same promise, different engine."
        second="Compared with MetaDAO, the DAICO and launchpads, weak spots included."
        note={{
          text: "MetaDAO mechanics from Basis Point and RockawayX, the DAICO from Buterin’s 2018 post. Covenant limits losses, it does not remove them: the floor starts at 60% of the sale price with default terms and falls as the team spends.",
          sources: [
            { label: "Basis Point, Aug 2026", href: "https://basispointres.substack.com/p/metadao-ownership-coins" },
            { label: "Explanation of DAICOs", href: "https://ethresear.ch/t/explanation-of-daicos/465" },
          ],
        }}
      />
      <HomePricing />
      <HomeFAQ />
      <HomeMilestones />
      <HomeClosingCTA />
    </SiteLayout>
  );
}
