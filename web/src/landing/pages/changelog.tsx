import type { Metadata } from "next";
import { ChangelogPage } from "./ChangelogPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = {
  title: "Milestones",
  description: "Covenant’s build milestones at BNB Hack Bangkok, gate by gate.",
};

export default function Page() {
  return <ChangelogPage />;
}
