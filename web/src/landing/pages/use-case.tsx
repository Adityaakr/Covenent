import type { Metadata } from "next";
import { pageMetadata } from "../meta";
import { notFound } from "next/navigation";
import { useCases } from "../content/useCases";
import { UseCasePage, useCaseSlugs } from "./UseCasePage";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return useCaseSlugs.map((slug) => ({ slug }));
}

/** Re-export from the route file (`export { default, generateStaticParams, generateMetadata } from ...`). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = useCases.find((x) => x.slug === slug);
  return item ? pageMetadata(item.name, item.headline, `/use-cases/${slug}`) : {};
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  // An unknown slug is a real 404 (status and the app's not-found page), not a 200 with the 404 layout.
  if (!useCaseSlugs.includes(slug)) notFound();
  return <UseCasePage slug={slug} />;
}
