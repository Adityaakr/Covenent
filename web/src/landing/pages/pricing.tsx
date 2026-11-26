import type { Metadata } from "next";
import { PricingPage } from "./PricingPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = {
  title: "Fees",
  description: "How Covenant is paid for: no fees for buyers or teams in v1, a Flap commission and an OpenFour template royalty.",
};

export default function Page() {
  return <PricingPage />;
}
