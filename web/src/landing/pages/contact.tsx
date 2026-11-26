import type { Metadata } from "next";
import { ContactPage } from "./ContactPage";

/** Re-export from the route file (`export { default, metadata } from ...`) for the page title. */
export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Covenant team about raising with rules.",
};

export default function Page() {
  return <ContactPage />;
}
