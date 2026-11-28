import { DocsPage, docMetadata } from "@/docs/DocsPage";

export const metadata = docMetadata("introduction");

export default function Page() {
  return <DocsPage slug="introduction" />;
}
