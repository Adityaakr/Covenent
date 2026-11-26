/* Covenant global navigation and footer content (content-plan.md "Global"). */

import { REPO_URL } from "@/lib/repo";

export { REPO_URL };
/** The judge guide: every claim with the command that checks it. */
export const JUDGES_URL = `${REPO_URL}/blob/main/JUDGES.md`;

export const navLinks = [
  { label: "Rules", href: "/features" },
  { label: "Use cases", href: "/use-cases" },
  { label: "Why we built it", href: "/#prior-art" },
  { label: "GitHub", href: REPO_URL },
  { label: "For judges", href: JUDGES_URL },
] as const;

export const navSecondary = { label: "Connect wallet", href: "/app" } as const;
export const navPrimary = { label: "Launch app", href: "/app" } as const;

/* The chosen headline and subline, verbatim (landing/meta.ts). */
export const footerTagline =
  "The operating stack for autonomous ventures. Capital, budgets and exits for businesses run by AI agents. Enforced by code, not courts. 24/7 on BNB Chain.";
export const footerStatus = "Testnet build · BNB Hack Bangkok";
export const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Rules", href: "/features" },
      { label: "Use cases", href: "/use-cases" },
      { label: "Launch app", href: "/app" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Why we built it", href: "/#prior-art" },
      { label: "Who named the problem", href: "/#research" },
      { label: "Source on GitHub", href: REPO_URL },
      { label: "Judge guide (JUDGES.md)", href: JUDGES_URL },
    ],
  },
  {
    title: "Built on",
    links: [
      { label: "Flap", href: "https://flap.sh" },
      { label: "CoinMarketCap", href: "https://coinmarketcap.com" },
      { label: "Four.meme", href: "https://four.meme" },
    ],
  },
] as const;
export const footerCopyright = "© 2026 Covenant. Built at BNB Hack Bangkok.";
export const footerNote = "Made for raises that keep their word";
export const wordmark = "Covenant";

export function isCurrent(current: string | undefined, href: string) {
  if (!current) return false;
  if (href === "/") return current === "/";
  return current === href || current.startsWith(href + "/");
}
