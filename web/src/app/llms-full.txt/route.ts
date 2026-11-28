/* /llms-full.txt: every docs page in one markdown file, built from the docs source (docs/source.ts). */
import { llmsFull } from "@/docs/source";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFull(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
