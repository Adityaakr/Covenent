import type { Metadata } from "next";
import { pageMetadata } from "../meta";
import { NotFoundPage } from "./NotFoundPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = pageMetadata("Page not found", "This page does not exist.");

export default function Page() {
  return <NotFoundPage />;
}
