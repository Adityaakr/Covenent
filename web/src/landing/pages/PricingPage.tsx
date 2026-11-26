import { SiteLayout } from "../components/SiteLayout";
import { PageCTA } from "../components/PageCTA";
import { PricingHero } from "../sections/pricing/PricingHero";
import { Plans } from "../sections/pricing/Plans";
import { Compare } from "../sections/pricing/Compare";
import { PricingQuote } from "../sections/pricing/PricingQuote";
import { PricingFAQ } from "../sections/pricing/PricingFAQ";

/** /pricing: Framer page gCJGzj4DE (Pricing). How Covenant is paid for. */
export function PricingPage() {
  return (
    <SiteLayout current="/pricing">
      <PricingHero />
      <Plans />
      <Compare />
      <PricingQuote />
      <PricingFAQ />
      <PageCTA
        heading="Raise under rules. Exit at book."
        body="Five rules hold the treasury. Nobody has to trust the team."
        primary={{ label: "Launch app", href: "/app" }}
        secondary={{ label: "Read the rules", href: "/features" }}
      />
    </SiteLayout>
  );
}
