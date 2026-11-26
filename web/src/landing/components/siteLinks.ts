/* Covenant global navigation and footer content (content-plan.md "Global"). */
export const navLinks = [
  { label: "Rules", href: "/features" },
  { label: "Fees", href: "/pricing" },
  { label: "Use cases", href: "/use-cases" },
  { label: "Milestones", href: "/changelog" },
  { label: "Contact", href: "/contact" },
] as const;

export const navSecondary = { label: "Connect wallet", href: "/app" } as const;
export const navPrimary = { label: "Launch app", href: "/app" } as const;

export const footerTagline =
  "Investor protections that enforce themselves. A launcher and vault for token raises on BNB Chain.";
export const footerStatus = "Testnet build · BNB Hack Bangkok";
export const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Rules", href: "/features" },
      { label: "Fees", href: "/pricing" },
      { label: "Milestones", href: "/changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Use cases", href: "/use-cases" },
      { label: "Contact", href: "/contact" },
      { label: "Launch app", href: "/app" },
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
