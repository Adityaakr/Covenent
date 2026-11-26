import type { Metadata } from "next";
import { pageMetadata } from "../meta";
import { ChangelogPage } from "./ChangelogPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = pageMetadata("Milestones", "Covenant’s build milestones at BNB Hack Bangkok, gate by gate.", "/changelog");

export default function Page() {
  return <ChangelogPage />;
}
