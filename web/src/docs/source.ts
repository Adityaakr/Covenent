/*
 * One source for the docs. Each page body is web/src/docs/content/<slug>.md, read at build time. Blocks the page
 * cannot hold as plain text are fenced as ```covenant``` directives and filled here from the code:
 *   addresses      the testnet contracts, from the baked deployment record (generated/testnet.json <- 97.json)
 *   tools          the MCP tool table, from generated/mcp-tools.json (written by `pnpm --dir server gen:llms`)
 *   mcp-reference  every MCP tool with its arguments, from generated/mcp-reference.md (same generator)
 *   diagram:<name> an inline SVG on the HTML page (docs/diagrams.tsx); its text version in markdown
 * and {{address:<key>}} in prose is the address of <key> in the deployment record.
 * The HTML pages, the /docs/<slug>.md twins, /llms.txt and /llms-full.txt all come from these functions, so they
 * cannot drift from each other.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import testnet from "@/generated/testnet.json";
import tools from "./generated/mcp-tools.json";
import { DIAGRAM_TEXT, type DiagramName } from "./diagram-text";
import { DOC_GROUPS, DOC_PAGES, docHref, type DocPage } from "./pages";

/** The public site, for absolute links in markdown and llms.txt (relative links do not survive a copy and paste). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://covenant.adibuilds.in").replace(/\/+$/, "");
export const REPO_URL = "https://github.com/Adityaakr/Covenent";

const CONTENT_DIR = path.join(process.cwd(), "src", "docs", "content");
const GENERATED_DIR = path.join(process.cwd(), "src", "docs", "generated");

export function readBody(slug: string): string {
  return readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
}

// ── addresses ──────────────────────────────────────────────────────────────

type Row = { key: string; label: string; note?: string };
const ADDRESS_GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Covenant contracts (current)",
    rows: [
      { key: "launcherFactory", label: "CovenantLauncherFactory", note: "production, timers in days" },
      { key: "vaultFactory", label: "CovenantVaultFactory", note: "production" },
      { key: "demoLauncherFactory", label: "CovenantLauncherFactory", note: "demo, timers in minutes" },
      { key: "demoVaultFactory", label: "CovenantVaultFactory", note: "demo" },
      { key: "oracle", label: "CovenantOracle", note: "pool TWAP and Atlas BNB/USD" },
      { key: "lens", label: "CovenantLens", note: "read-only views for the app" },
      { key: "liteVaultTemplate", label: "CovenantLiteVault template", note: "Four.meme path" },
      { key: "vaultDisplayLibrary", label: "CovenantVaultDisplay", note: "linked library" },
    ],
  },
  {
    title: "Partner contracts on chain 97",
    rows: [
      { key: "portal", label: "Flap Portal", note: "launches every covenant token and pool" },
      { key: "dockRouter", label: "Flap Token Dock router", note: "holds reserved sale and team tokens" },
      { key: "taxTokenImpl", label: "Flap tax token implementation" },
      { key: "guardian", label: "Flap Guardian", note: "upgrade authority; no code on chain 97 today" },
      { key: "router", label: "PancakeSwap V2 router" },
      { key: "wbnb", label: "WBNB" },
      { key: "atlasPushBnbUsd", label: "Atlas BNB/USD push feed" },
      { key: "atlasSigner", label: "Atlas report signer", note: "account" },
      { key: "identityRegistry", label: "ERC-8004 identity registry" },
      { key: "reputationRegistry", label: "ERC-8004 reputation registry" },
      { key: "demoUsdc", label: "Demo USDC", note: "test token for the agent economy demo" },
    ],
  },
  {
    title: "First covenant and earlier deployments",
    rows: [
      { key: "legacyCovenantVault", label: "CVT vault", note: "first testnet covenant, wound down" },
      { key: "legacyCovenantLauncher", label: "CVT launcher" },
      { key: "round1CovenantLauncher", label: "BNBH2026 launcher", note: "raise that never launched" },
      { key: "previousLauncherFactory", label: "Launcher factory", note: "first deployment" },
      { key: "previousVaultFactory", label: "Vault factory", note: "first deployment" },
      { key: "previousDemoLauncherFactory", label: "Demo launcher factory", note: "first deployment, made CVT" },
      { key: "previousDemoVaultFactory", label: "Demo vault factory", note: "first deployment" },
      { key: "previousOracle", label: "Oracle", note: "first deployment" },
      { key: "round1LauncherFactory", label: "Launcher factory", note: "26 Nov audit-fix deployment" },
      { key: "round1VaultFactory", label: "Vault factory", note: "26 Nov audit-fix deployment" },
      { key: "round1DemoLauncherFactory", label: "Demo launcher factory", note: "26 Nov audit-fix deployment" },
      { key: "round1DemoVaultFactory", label: "Demo vault factory", note: "26 Nov audit-fix deployment" },
      { key: "round1Oracle", label: "Oracle", note: "26 Nov audit-fix deployment" },
      { key: "deployer", label: "Deployer", note: "account" },
    ],
  },
];

const deployment = testnet.deployment as { chainId: number; addresses: Record<string, string> };

export function explorerAddressUrl(chainId: number, address: string): string | null {
  if (chainId === 97) return `https://testnet.bscscan.com/address/${address}`;
  if (chainId === 56) return `https://bscscan.com/address/${address}`;
  return null;
}

/** Every address of the deployment record, grouped and labelled; keys the labels do not know land in "Other". */
export function addressGroups() {
  const a = deployment.addresses;
  const known = new Set(ADDRESS_GROUPS.flatMap((g) => g.rows.map((r) => r.key)));
  const groups = ADDRESS_GROUPS.map((g) => ({
    title: g.title,
    rows: g.rows.filter((r) => a[r.key]).map((r) => ({ ...r, address: a[r.key]! })),
  }));
  const other = Object.keys(a).filter((k) => !known.has(k)).sort().map((k) => ({ key: k, label: k, address: a[k]! }));
  if (other.length) groups.push({ title: "Other", rows: other });
  return { chainId: deployment.chainId, groups: groups.filter((g) => g.rows.length) };
}

function addressesMarkdown(): string {
  const { chainId, groups } = addressGroups();
  return groups
    .map((g) => {
      const rows = g.rows.map((r) => {
        const url = explorerAddressUrl(chainId, r.address);
        const addr = url ? `[\`${r.address}\`](${url})` : `\`${r.address}\``;
        return `| ${r.label}${"note" in r && r.note ? ` (${r.note})` : ""} | ${addr} |`;
      });
      return [`### ${g.title}`, "", "| Contract | Address |", "|---|---|", ...rows].join("\n");
    })
    .join("\n\n");
}

// ── MCP tools ──────────────────────────────────────────────────────────────

type ToolEntry = { name: string; title: string; signer: "read" | "anyone" | "team"; args: { name: string; required: boolean }[] };
export const MCP_TOOLS = tools.tools as ToolEntry[];
const SIGNER: Record<ToolEntry["signer"], string> = { read: "read only", anyone: "any wallet", team: "team wallet" };

function toolsMarkdown(): string {
  const rows = MCP_TOOLS.map((t) => {
    const args = t.args.filter((a) => a.name !== "covenant").map((a) => `${a.name}${a.required ? "" : "?"}`);
    const takes = t.args.some((a) => a.name === "covenant") ? ["covenant", ...args] : args;
    return `| \`${t.name}\`${takes.length ? ` (${takes.join(", ")})` : ""} | ${SIGNER[t.signer]} | ${t.title} |`;
  });
  return ["| Tool and arguments | Signed by | What it does |", "|---|---|---|", ...rows].join("\n");
}

// ── expansion ──────────────────────────────────────────────────────────────

const DIRECTIVE = /^```covenant\n([\s\S]*?)\n```$/gm;

/** Fill the directives. `html` keeps diagram fences for the page to draw; `md` puts their text version in. */
export function expand(body: string, mode: "html" | "md"): string {
  // {{address:<key>}}: an address from the deployment record, so prose never carries a copy that can go stale
  const withAddresses = body.replace(/\{\{address:(\w+)\}\}/g, (_, key: string) => {
    const a = deployment.addresses[key];
    if (!a) throw new Error(`docs: the deployment record has no ${key}`);
    return a;
  });
  return withAddresses.replace(DIRECTIVE, (whole, raw: string) => {
    const d = raw.trim();
    if (d === "addresses") return addressesMarkdown();
    if (d === "tools") return toolsMarkdown();
    if (d === "mcp-reference") return readFileSync(path.join(GENERATED_DIR, "mcp-reference.md"), "utf8").trim();
    if (d.startsWith("diagram:")) {
      const name = d.slice("diagram:".length) as DiagramName;
      if (!(name in DIAGRAM_TEXT)) throw new Error(`docs: unknown diagram ${name}`);
      return mode === "html" ? whole : DIAGRAM_TEXT[name];
    }
    throw new Error(`docs: unknown directive ${d}`);
  });
}

/** Site-relative links become absolute; links to docs pages point at their markdown twins. */
function absoluteLinks(md: string): string {
  return md.replace(/\]\((\/[^)\s]*)\)/g, (_, href: string) => {
    const [p, hash] = href.split("#") as [string, string?];
    const doc = p === "/docs" ? "introduction" : p.startsWith("/docs/") ? p.slice("/docs/".length) : null;
    const target = doc && DOC_PAGES.some((d) => d.slug === doc) ? `${SITE_URL}/docs/${doc}.md` : `${SITE_URL}${p}`;
    return `](${target}${hash ? `#${hash}` : ""})`;
  });
}

/** A page as clean markdown: what /docs/<slug>.md serves and /llms-full.txt joins. */
export function pageMarkdown(page: DocPage): string {
  const body = absoluteLinks(expand(readBody(page.slug), "md")).trim();
  return `# ${page.title}\n\n> ${page.answer}\n\n${body}\n\nSource: ${SITE_URL}${docHref(page.slug)}\n`;
}

const SUMMARY =
  "The operating stack for autonomous ventures. Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain.";

/** /llms.txt: the llmstxt.org index of the docs, with each page's one-line answer. */
export function llmsTxt(): string {
  const out = [
    "# Covenant",
    "",
    `> ${SUMMARY}`,
    "",
    "Covenant is a launcher and a vault for token raises on BNB Chain, built on Flap's Pool Launch. It is deployed on BNB testnet (chain 97) only and is not audited. Every page below is plain markdown; /llms-full.txt is all of them in one file.",
    "",
  ];
  for (const g of DOC_GROUPS) {
    const pages = DOC_PAGES.filter((p) => p.group === g);
    if (!pages.length) continue;
    out.push(`## ${g}`, "");
    for (const p of pages) out.push(`- [${p.title}](${SITE_URL}/docs/${p.slug}.md): ${p.answer}`);
    out.push("");
  }
  const team = MCP_TOOLS.filter((t) => t.signer === "team").map((t) => t.name);
  const anyone = MCP_TOOLS.filter((t) => t.signer === "anyone").map((t) => t.name);
  const read = MCP_TOOLS.filter((t) => t.signer === "read").map((t) => t.name);
  out.push(
    "## MCP server",
    "",
    "Run from a clone of the repository (Node 22, pnpm): `pnpm --dir <repo>/server install`, then `pnpm --dir <repo>/server mcp`. It reads BNB testnet with no key; writes return unsigned, simulated transactions. Details: " +
      `${SITE_URL}/docs/agents.md.`,
    "",
    `- Read tools: ${read.join(", ")}`,
    `- Write tools, any wallet signs: ${anyone.join(", ")}`,
    `- Write tools, the team wallet signs: ${team.join(", ")}`,
    "",
    "## Optional",
    "",
    `- [Source code](${REPO_URL}): contracts, server, web app`,
    `- [Design document](${REPO_URL}/blob/main/docs/DESIGN.md): the rules, formulas and threat model, written before the code`,
    `- [Judge guide](${REPO_URL}/blob/main/JUDGES.md): every claim with the command that checks it`,
    `- [Known issues](${REPO_URL}/blob/main/docs/KNOWN-ISSUES.md): every review finding and its status`,
    "",
  );
  return out.join("\n");
}

/** /llms-full.txt: every docs page in order, as markdown. */
export function llmsFull(): string {
  const head = [
    "# Covenant docs (full text)",
    "",
    `> ${SUMMARY}`,
    "",
    `Every page of ${SITE_URL}/docs in one file, generated from the same source as the site. The index is ${SITE_URL}/llms.txt.`,
    "",
  ].join("\n");
  const pages = DOC_PAGES.map((p) => demoteHeadings(pageMarkdown(p))).join("\n");
  return `${head}\n${pages}`;
}

/** One level down for every heading outside code fences, so each page sits under the file's title. */
function demoteHeadings(md: string): string {
  let fenced = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^(```|~~~)/.test(line)) fenced = !fenced;
      return !fenced && /^#{1,5} /.test(line) ? `#${line}` : line;
    })
    .join("\n");
}

/** The h2 headings of a page body (outside code fences), for "On this page". */
export function outline(body: string): string[] {
  let fenced = false;
  const out: string[] = [];
  for (const line of body.split("\n")) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced;
    else if (!fenced && line.startsWith("## ")) out.push(line.slice(3).trim());
  }
  return out;
}

/** The anchor id of a heading: lower case, words joined by hyphens (the page and the outline both use it). */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
