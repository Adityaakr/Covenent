import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIAGRAM_TEXT } from "./diagram-text";
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

  it("a newcomer reads the introduction, why, how, agentic finance and the quickstart before any reference", () => {
    expect(DOC_PAGES.slice(0, 5).map((p) => p.slug)).toEqual(["introduction", "why-covenant", "how-it-works", "agentic-finance", "quickstart"]);
    expect(DOC_PAGES[0]!.title).toBe("The operating stack for autonomous ventures");
  });

  it("every diagram is drawn on some page", () => {
    const used = new Set(DOC_PAGES.flatMap((p) => [...readBody(p.slug).matchAll(/```covenant\ndiagram:(\w+)\n```/g)].map((m) => m[1]!)));
    for (const name of Object.keys(DIAGRAM_TEXT)) expect(used.has(name), name).toBe(true);
  });

  it("the defaults on the rules page are the contracts' defaults (CovenantProfiles.defaultTerms)", () => {
    const sol = readFileSync(path.join(REPO_ROOT, "contracts/src/launcher/CovenantProfiles.sol"), "utf8");
    const body = sol.slice(sol.indexOf("function defaultTerms"), sol.indexOf("function demoTerms"));
    const num = (field: string) => {
      const m = body.match(new RegExp(`t\\.${field.replace(/[[\]]/g, "\\$&")} = ([0-9_]+)( ether| days)?;`));
      if (!m) throw new Error(`no ${field} in defaultTerms`);
      return Number(m[1]!.replace(/_/g, ""));
    };
    const pct = (bps: number) => `${bps / 100}%`;
    const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
    const rules = readBody("rules");
    const row = (term: string) => rules.split("\n").find((l) => l.startsWith(`| ${term}`)) ?? "";
    expect(row("Supply split")).toContain(`${pct(num("saleBps"))} sale, ${pct(num("poolBps"))} pool`);
    expect(row("Raise")).toContain(`minimum ${num("minRaise")} BNB, cap ${num("cap")} BNB, ${num("saleDuration")}-day sale`);
    expect(row("Trading tax")).toContain(`${pct(num("buyTaxBps"))} buy, ${pct(num("sellTaxBps"))} sell`);
    expect(row("Tap")).toContain(`${usd(num("tapUsdPer30d"))} per 30 days, capped at ${pct(num("tapCapBps"))}`);
    expect(row("Unlock")).toContain(`${pct(num("trancheBps[0]"))} at ${num("trancheMultiple[0]") / 100}x, ${pct(num("trancheBps[1]"))} at ${num("trancheMultiple[1]") / 100}x, ${pct(num("trancheBps[2]"))} at ${num("trancheMultiple[2]") / 100}x; ${num("cliff")}-day cliff; ${num("unlockWindow")}-day unlock window`);
    expect(row("Exit")).toContain(`${num("exitStreak")}-day streak, ${num("roundLength")}-day round, ${num("cooldown")}-day cooldown, ${pct(num("exitFeeBps"))} fee`);
    expect(row("Abandonment")).toContain(`${num("heartbeat")}-day heartbeat window`);
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
