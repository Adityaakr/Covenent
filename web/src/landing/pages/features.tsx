import type { Metadata } from "next";
import { FeaturesPage } from "./FeaturesPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = {
  title: "Rules",
  description: "The five rules that bind a team or an AI agent after a token raise: tap, performance unlock, book-value exit, abandonment switch and disclosure.",
};

export default function Page() {
  return <FeaturesPage />;
}
