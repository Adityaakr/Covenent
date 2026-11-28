import { notFound } from "next/navigation";
import { DocsPage, docMetadata } from "@/docs/DocsPage";
import { DOC_PAGES, findDoc } from "@/docs/pages";

// every page is built at build time from web/src/docs/content; an unknown slug is a 404
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_PAGES.filter((p) => p.slug !== "introduction").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return findDoc(slug) ? docMetadata(slug) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!findDoc(slug) || slug === "introduction") notFound();
  return <DocsPage slug={slug} />;
}
