import type { Metadata } from "next";
import { UseCasesPage } from "./UseCasesPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = {
  title: "Use cases",
  description: "Raises that bind the team, from AI agent issuers to human teams and launchpads.",
};

export default function Page() {
  return <UseCasesPage />;
}
