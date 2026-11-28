/* /docs/<slug>.md (rewritten here in next.config.ts): a docs page as clean markdown, from the same source as the
   HTML page (docs/source.ts). */
import { DOC_PAGES, findDoc } from "@/docs/pages";
import { pageMarkdown } from "@/docs/source";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const page = findDoc(slug);
  if (!page) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(pageMarkdown(page), { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
