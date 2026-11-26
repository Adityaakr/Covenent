import { SiteLayout } from "../components/SiteLayout";
import { PageCTA } from "../components/PageCTA";
import { useCases } from "../content/useCases";
import { UseCaseHeader, UseCaseCover, UseCaseBody, UseCaseQuote } from "../sections/usecases/UseCaseDetail";
import { NotFoundPage } from "./NotFoundPage";

export const useCaseSlugs: string[] = useCases.map((u) => u.slug);

/** /use-cases/[slug]: Framer CMS detail page for Stories (UUPt0HfzN). */
export function UseCasePage({ slug }: { slug: string }) {
  const u = useCases.find((x) => x.slug === slug);
  if (!u) return <NotFoundPage />;
  return (
    <SiteLayout current="/use-cases">
      <UseCaseHeader u={u} />
      <UseCaseCover u={u} />
      <UseCaseBody u={u} />
      <UseCaseQuote u={u} />
      <PageCTA
        heading="Raise under rules. Exit at book."
        body="Five rules hold the treasury. Nobody has to trust the team."
        secondary={{ label: "Read the rules", href: "/features" }}
        primary={{ label: "Launch app", href: "/app" }}
      />
    </SiteLayout>
  );
}
