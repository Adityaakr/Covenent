import { SiteLayout } from "../components/SiteLayout";
import { HomeHero } from "../sections/home/HomeHero";
import { HomeFeatures } from "../sections/home/HomeFeatures";
import { HomeStats } from "../sections/home/HomeStats";
import { HomeAgentLayer } from "../sections/home/HomeAgentLayer";
import { HomeUseCases } from "../sections/home/HomeUseCases";
import { HomeQuote } from "../sections/home/HomeQuote";
import { HomePricing } from "../sections/home/HomePricing";
import { HomeFAQ } from "../sections/home/HomeFAQ";
import { HomeMilestones } from "../sections/home/HomeMilestones";
import { HomeClosingCTA } from "../sections/home/HomeClosingCTA";

export function Landing() {
  return (
    <SiteLayout current="/">
      <HomeHero />
      <HomeFeatures />
      <HomeStats />
      <HomeAgentLayer />
      <HomeUseCases />
      <HomeQuote />
      <HomePricing />
      <HomeFAQ />
      <HomeMilestones />
      <HomeClosingCTA />
    </SiteLayout>
  );
}
