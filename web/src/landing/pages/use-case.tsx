import { UseCasePage, useCaseSlugs } from "./UseCasePage";

export function generateStaticParams() {
  return useCaseSlugs.map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <UseCasePage slug={slug} />;
}
