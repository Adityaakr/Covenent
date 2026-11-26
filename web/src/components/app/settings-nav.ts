import type { IconName } from "./icons";

/** Settings holds the account and the tools around the product: test funds, the contracts, agents, the simulator. */
export const SETTINGS: { href: string; label: string; icon: IconName; group: "account" | "tools"; exact?: boolean }[] = [
  { href: "/app/settings", label: "Account", icon: "user", group: "account", exact: true },
  { href: "/app/settings/funds", label: "Test funds", icon: "drop", group: "account" },
  { href: "/app/settings/network", label: "Network", icon: "globe", group: "account" },
  { href: "/app/settings/agents", label: "Agents & MCP", icon: "agent", group: "account" },
  { href: "/app/settings/simulator", label: "Simulator", icon: "flask", group: "tools" },
  { href: "/app/settings/demo", label: "Demo script", icon: "play", group: "tools" },
];
