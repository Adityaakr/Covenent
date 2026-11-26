import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

/* /pricing is retired: the landing no longer has a fees page. The route still re-exports this module, so it
   redirects home for good instead of serving a dead page. */
export const metadata: Metadata = { title: "Covenant", robots: { index: false } };

export default function Page() {
  permanentRedirect("/");
}
