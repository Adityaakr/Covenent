import type { Metadata } from "next";
import { pageMetadata } from "../meta";
import { PricingPage } from "./PricingPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = pageMetadata("Fees", "How Covenant is paid for: no fees for buyers or teams in v1, a Flap commission and an OpenFour template royalty.", "/pricing");

export default function Page() {
  return <PricingPage />;
}
