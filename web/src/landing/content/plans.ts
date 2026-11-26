/** Owner: pricing agent. Also rendered by the home pricing preview.
 * Source: docs/DESIGN.md "Business model and roadmap" (Revenue lines), "Rule 3", "Lifecycle",
 * "Four.meme and OpenFour". Sorted by the template's Order field (array order). */
export type Plan = {
  name: string; slug: string; price: string; unit: string; description: string;
  statusValue: string; // shown after the "Status:" label where the template shows "Yearly:"
  buttonLabel: string; buttonHref: string; highlighted: boolean; badge?: string; features: string[];
};

/** Label that replaces the template's "Yearly:" label. */
export const planStatusLabel = "Status:";

/** Note under the plans grid (template: "Prices in USD, excluding tax. Guests are free on every plan."). */
export const plansNote = "No new fee for buyers or teams in v1. A raise fee and services come later.";

export const plans: Plan[] = [
  {
    name: "Buyers",
    slug: "buyers",
    price: "$0",
    unit: "to commit or refund",
    description: "For anyone committing BNB to a raise.",
    statusValue: "No fee in v1",
    buttonLabel: "Launch app",
    buttonHref: "/app",
    highlighted: false,
    features: [
      "Refunds if oversubscribed",
      "Full refund under minimum",
      "Redeem at book in a round",
      "1% exit fee, kept by vault",
      "No fee after wind-down",
    ],
  },
  {
    name: "Teams",
    slug: "teams",
    price: "$0",
    unit: "raise fee in v1",
    description: "For human teams and AI agents that raise.",
    statusValue: "Raise fee set to zero",
    buttonLabel: "Launch app",
    buttonHref: "/app",
    highlighted: true,
    badge: "Free in v1",
    features: [
      "Capped raise on Pool Launch",
      "4% tap cap per 30 days",
      "Unlocks at price multiples",
      "A live covenant sheet",
      "Same rules for agent issuers",
    ],
  },
  {
    name: "Flap commission",
    slug: "flap-commission",
    price: "TBC",
    unit: "of Flap’s protocol fee",
    description: "Paid by Flap from its fee, not the project.",
    statusValue: "Rate to confirm",
    buttonLabel: "Contact the team",
    buttonHref: "/contact",
    highlighted: false,
    features: [
      "Set by commissionReceiver",
      "Derived from the tax rate",
      "Paid from Flap’s fee",
      "Earned on lifetime volume",
      "No cost to buyers or teams",
    ],
  },
  {
    name: "OpenFour royalty",
    slug: "openfour-royalty",
    price: "~6%",
    unit: "of founder tax receipts",
    description: "For Four.meme tokens on our vault template.",
    statusValue: "Live on Four.meme",
    buttonLabel: "Contact the team",
    buttonHref: "/contact",
    highlighted: false,
    features: [
      "ROYALTY_BPS = 600",
      "From the founder’s tax share",
      "Adds the tap and the switch",
      "Template fixed after create",
      "Founders launch as before",
    ],
  },
];
