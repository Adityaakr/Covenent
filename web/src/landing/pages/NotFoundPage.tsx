import { SiteLayout } from "../components/SiteLayout";
import { NotFound } from "../sections/notfound/NotFound";

/** Not found (Framer page QEEZ4rtiI). */
export function NotFoundPage() {
  return (
    <SiteLayout current="/404">
      <NotFound />
    </SiteLayout>
  );
}
