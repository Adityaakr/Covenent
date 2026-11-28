import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOC_PAGES } from "./pages";
import { addressGroups, expand, llmsFull, llmsTxt, MCP_TOOLS, outline, pageMarkdown, readBody, SITE_URL } from "./source";

const APP_DIR = path.join(process.cwd(), "src", "app");
const REPO_ROOT = path.resolve(process.cwd(), "..");

/** True when a site path is served by a route under src/app (a dynamic segment matches any value). */
function routeExists(p: string): boolean {
  const parts = p.split("?")[0]!.split("#")[0]!.split("/").filter(Boolean);
  let dir = APP_DIR;
  for (const part of parts) {
    const exact = path.join(dir, part);
    if (existsSync(exact) && statSync(exact).isDirectory()) { dir = exact; continue; }
    const dyn = readdirSync(dir).find((d) => /^\[[^.]+\]$/.test(d));
    if (!dyn) return false;
    dir = path.join(dir, dyn);
  }
  return existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "route.ts"));
}

const links = (md: string) => [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!);

describe("docs", () => {
  it("every page has a body, and every directive in it expands", () => {
    for (const p of DOC_PAGES) {
      const body = readBody(p.slug);
      expect(body.trim().length, p.slug).toBeGreaterThan(100);
      expect(p.answer.length, p.slug).toBeLessThan(260);
      const md = expand(body, "md");
      expect(md, p.slug).not.toMatch(/```covenant|\{\{address:/);
    }
  });

  it("every internal link points at a docs page, a heading on it, or a route the app serves", () => {
    for (const p of DOC_PAGES) {
      for (const href of links(expand(readBody(p.slug), "html"))) {
        if (!href.startsWith("/")) continue;
        const [route, hash] = href.split("#") as [string, string?];
        const doc = route === "/docs" ? "introduction" : route.startsWith("/docs/") ? route.slice(6) : null;
        if (doc && !doc.endsWith(".md")) {
          const target = DOC_PAGES.find((d) => d.slug === doc);
          expect(target, `${p.slug} -> ${href}`).toBeTruthy();
          if (hash) expect(outline(expand(readBody(doc), "html")).map((h) => h.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-")), `${p.slug} -> ${href}`).toContain(hash);
        } else if (route.endsWith(".md")) {
          expect(DOC_PAGES.some((d) => route === `/docs/${d.slug}.md`), `${p.slug} -> ${href}`).toBe(true);
        } else {
          expect(routeExists(route), `${p.slug} -> ${href}`).toBe(true);
        }
      }
    }
  });

  it("links into the repository name files that exist", () => {
    for (const p of DOC_PAGES) {
      for (const href of links(readBody(p.slug))) {
        const m = href.match(/^https:\/\/github\.com\/Adityaakr\/Covenent\/blob\/main\/([^#]+)/);
        if (m) expect(existsSync(path.join(REPO_ROOT, m[1]!)), `${p.slug} -> ${href}`).toBe(true);
      }
    }
  });

  it("the markdown twins are absolute and the llms files cover every page", () => {
    const index = llmsTxt();
    const full = llmsFull();
    for (const p of DOC_PAGES) {
      expect(index).toContain(`${SITE_URL}/docs/${p.slug}.md`);
      expect(full).toContain(`## ${p.title}\n`);
      expect(pageMarkdown(p)).not.toMatch(/\]\(\/(?!\/)/);
    }
    for (const t of MCP_TOOLS) expect(index).toContain(t.name);
  });

  it("every address on the contracts page is an address of the deployment record", () => {
    const { chainId, groups } = addressGroups();
    expect(chainId).toBe(97);
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(r.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(groups.find((g) => g.title === "Other")).toBeUndefined();
  });
});
