import { SiteLayout } from "../components/SiteLayout";
import { HomeHero } from "../sections/home/HomeHero";
import { HomeProblem } from "../sections/home/HomeProblem";
import { HomeVoices } from "../sections/home/HomeVoices";
import { HomeFeatures } from "../sections/home/HomeFeatures";
import { HomeLifecycle } from "../sections/home/HomeLifecycle";
import { HomeBuiltOn } from "../sections/home/HomeBuiltOn";
import { HomeAgentLayer } from "../sections/home/HomeAgentLayer";
import { HomeUseCases } from "../sections/home/HomeUseCases";
import { HomeFourMeme } from "../sections/home/HomeFourMeme";
import { HomeQuote } from "../sections/home/HomeQuote";
import { HomePriorArt } from "../sections/home/HomePriorArt";
import { HomeClosingCTA } from "../sections/home/HomeClosingCTA";

/* Home: the problem and who named it, then how Covenant answers (the rules, the lifecycle, what it is built on, the
   agent layer), who it is for (use cases, Four.meme), why we built it, and the call to action. Every section uses the
   template's own patterns (docs/landing/content/home-v2.md). */
export function Landing() {
  return (
    <SiteLayout current="/">
      <HomeHero />
      <HomeProblem />
      <HomeVoices />
      <HomeFeatures />
      <HomeLifecycle />
      <HomeBuiltOn />
      <HomeAgentLayer />
      <HomeUseCases />
      <HomeFourMeme />
      <HomeQuote />
      <HomePriorArt />
      <HomeClosingCTA />
    </SiteLayout>
  );
}
