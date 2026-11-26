import type { Metadata } from "next";
import { pageMetadata } from "../meta";
import { UseCasesPage } from "./UseCasesPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = pageMetadata("Use cases", "Five ways to raise under rules: an AI agent raising working capital, a community round, an inference agent buying its own GPUs, machines that own themselves and a launchpad’s protected tier.", "/use-cases");

export default function Page() {
  return <UseCasesPage />;
}
