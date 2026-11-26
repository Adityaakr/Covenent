import type { Metadata } from "next";
import { NotFoundPage } from "./NotFoundPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist.",
};

export default function Page() {
  return <NotFoundPage />;
}
