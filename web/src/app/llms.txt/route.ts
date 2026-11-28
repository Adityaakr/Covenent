/* /llms.txt (llmstxt.org): the docs index for language models, built from the docs source (docs/source.ts). */
import { llmsTxt } from "@/docs/source";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
