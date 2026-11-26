import type { Metadata } from "next";
import { pageMetadata } from "../meta";
import { ContactPage } from "./ContactPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = pageMetadata("Contact", "Talk to the Covenant team about raising with rules.", "/contact");

export default function Page() {
  return <ContactPage />;
}
