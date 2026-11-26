/**
 * What each integration does in Covenant, how we call it, where it lives and how far it is proven. Shared by the
 * home "How it's built" diagram and the /features integrations grid. Every line is checked against the build
 * (contracts/, server/, docs/DEPLOY.md on the integration branch) and, for the Atlas feed, against BNB testnet itself
 * on 26 Nov 2026 (decimals() = 18, description() = "SingleFeed BNB/USD", latestRoundData() updated seconds before).
 * Our contracts are deployed on BNB testnet (contracts/deployments/97.json, 26 Nov 2026, source verified on Sourcify);
 * nothing is on BNB Chain mainnet. Statuses say exactly how far each piece is proven.
 * Citations: docs/landing/sources.md "How it's built".
 */
export type IntegrationStatus = "live" | "testnet" | "fork" | "planned";
export type ChainAddress = { label: string; address: string; chain: "bsc" | "bsc-testnet" };

export type Integration = {
  id: string;
  name: string;
  logo: string;
  /** diagram node centre, % of the diagram box */
  x: number;
  y: number;
  flow: string;
  status: IntegrationStatus;
  statusText: string;
  /** one line for tiles */
  short: string;
  /** what it does in Covenant */
  does: string;
  /** how we call it, concretely */
  how: string[];
  addresses: ChainAddress[];
  without: string;
};

export const statusLabel: Record<IntegrationStatus, string> = {
  live: "Live API",
  testnet: "Live on testnet",
  fork: "Proven on mainnet fork",
  planned: "Planned",
};

export const integrations: Integration[] = [
  {
    id: "flap",
    name: "Flap Pool Launch",
    logo: "/landing/logos/flap.svg",
    x: 15,
    y: 20,
    flow: "Raise, tokens and tax in",
    status: "fork",
    statusText: "Proven on a BNB Chain mainnet fork; our factories are deployed on testnet, waiting for Flap to enable the launcher factory",
    short: "Creates the token, seeds the pool, docks the reserved tokens and routes tax to the vault",
    does: "Our launcher and vault are a Flap Pool Launch pair. Flap creates the token, seeds the PancakeSwap pool at the sale price, holds the vault’s reserved tokens in its Token Dock and routes trading tax to the vault.",
    how: [
      "The team creates a covenant with Portal.newLauncher and our launcher factory.",
      "At finalize, the launcher calls Portal.launchTaxTokenV2 with the pool quote.",
      "The vault deposits the reserved tokens through the TokenDockRouter.",
    ],
    addresses: [
      { label: "Portal", address: "0x000042108465206185A077Edc3F3fd2b49060000", chain: "bsc-testnet" },
      { label: "TokenDockRouter", address: "0x000048E888aBf09f690a952E1b386b2D031a0000", chain: "bsc-testnet" },
      { label: "Our launcher factory", address: "0x373491d66f68FE2Acc370B12E6FA2bB488FC6A0B", chain: "bsc-testnet" },
      { label: "Our vault factory", address: "0x2665c44Ea346De54207b8E8C1A351aE3e82FCf57", chain: "bsc-testnet" },
      { label: "Demo launcher factory", address: "0x89D7E30109D62F72fBf717aafc2d59d21CA4DC48", chain: "bsc-testnet" },
      { label: "Demo vault factory", address: "0xF8Bf9A01457C45a8F53E7ae32D863B38d3876c97", chain: "bsc-testnet" },
    ],
    without: "No raise, no launch and no tax coming into the treasury.",
  },
  {
    id: "pancakeswap",
    name: "PancakeSwap V2",
    logo: "/landing/logos/pancakeswap.svg",
    x: 15,
    y: 80,
    flow: "Pool price",
    status: "fork",
    statusText: "Proven on a BNB Chain mainnet fork",
    short: "The pool, and the time-weighted price the exit reads on-chain",
    does: "The pool the token trades in, seeded and locked by Flap at launch. Its time-weighted price is the one number the exit rule compares with book value.",
    how: [
      "Each poke reads the pair’s cumulative price (price0CumulativeLast / price1CumulativeLast).",
      "CovenantOracle turns it into the time-weighted price since that vault’s last poke.",
      "No oracle and no depth gate on the exit: pool price and book value are both on-chain.",
    ],
    addresses: [],
    without: "Nothing to compare with book value, so no exit.",
  },
  {
    id: "atlas",
    name: "Atlas",
    logo: "/landing/logos/atlas.svg",
    x: 85,
    y: 20,
    flow: "BNB/USD",
    status: "testnet",
    statusText: "Live on BNB testnet: our CovenantOracle reads the BNB/USD push feed",
    short: "Live BNB/USD for the dollar budget and dollar unlocks; never needed for the exit",
    does: "Live BNB/USD from Atlas’s on-chain push feed prices the dollar budget and the dollar unlock multiples, and feeds the strict trust gate that keeps a faked pump from counting toward an unlock. The exit never depends on it.",
    how: [
      "CovenantOracle reads the feed’s latestRoundData (Chainlink-compatible, 18 decimals, updating continuously).",
      "Signed Atlas pull reports are also accepted when a signing key is set; they are tried first.",
      "Only strict observations (fresh BNB/USD and a pool at least half its seed) move the dollar rules.",
    ],
    addresses: [
      { label: "BNB/USD push feed", address: "0x3957d289ee9C38272377786787ea34F9dd29788D", chain: "bsc-testnet" },
      { label: "BTC/USD push feed", address: "0x83B2F2c20df36F166cF5b3f017204cbB7BABcAD0", chain: "bsc-testnet" },
      { label: "ETH/USD push feed", address: "0x35369dEcD8c662954B3D24acc2A862C708A34fD2", chain: "bsc-testnet" },
      { label: "Our CovenantOracle", address: "0x3CC607931edaF307dC867111e48cAc28e31fF052", chain: "bsc-testnet" },
    ],
    without: "The dollar rules freeze, then fall back in holders’ favour. The exit keeps working.",
  },
  {
    id: "cmc",
    name: "CoinMarketCap",
    logo: "/landing/logos/coinmarketcap.svg",
    x: 85,
    y: 50,
    flow: "Market data",
    status: "live",
    statusText: "Live: our server calls the CoinMarketCap API",
    short: "Pair quotes, holders and candles on the sheet; real launches for the simulator",
    does: "Market context next to the rules: what the pool trades at, who holds it, how liquidity moves, and real launches to test terms against.",
    how: [
      "/v4/dex/pairs/quotes/latest: the live quote, holders and security scan on each covenant sheet.",
      "/v1/k-line/candles: price history for the price-against-book chart and the launch simulator.",
      "/v1/dex/liquidity-change/list and /v1/dex/tokens/transactions: depth alerts and who is selling into a round.",
    ],
    addresses: [],
    without: "The sheet still reads the chain, but loses market context, and the simulator has no real launches.",
  },
  {
    id: "erc8004",
    name: "ERC-8004",
    logo: "/landing/logos/erc-8004.svg",
    x: 85,
    y: 80,
    flow: "Agent identity",
    status: "fork",
    statusText: "Proven on a BNB Chain mainnet fork against the live registries",
    short: "Agent identity bound to the team wallet, outcomes on its reputation record",
    does: "An agent’s identity is bound to the team wallet when the covenant is created, and outcomes (an unlock, an abandonment, a wind-down) are written to its reputation record, so its history follows it to its next raise.",
    how: [
      "The launcher factory requires IdentityRegistry.ownerOf(agentId) to be the team wallet.",
      "The vault calls ReputationRegistry.giveFeedback inside try/catch, so it can never block a rule.",
    ],
    addresses: [
      { label: "Identity", address: "0x8004A818BFB912233c491871b3d84c89A494BD9e", chain: "bsc-testnet" },
      { label: "Reputation", address: "0x8004B663056A597Dffe9eCcC1965A193B7388713", chain: "bsc-testnet" },
      { label: "Identity", address: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", chain: "bsc" },
      { label: "Reputation", address: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", chain: "bsc" },
    ],
    without: "An agent’s track record would not follow it into its next raise.",
  },
  {
    id: "four",
    name: "Four.meme",
    logo: "/landing/logos/four-meme.svg",
    x: 15,
    y: 50,
    flow: "Lite template",
    status: "fork",
    statusText: "Proven on a BNB Chain mainnet fork; token creation happens on Four.meme’s site",
    short: "The Covenant Lite tax-vault template on OpenFour",
    does: "The Covenant Lite tax-vault template: a founder’s tax share goes to a vault with a capped draw per period and an abandonment switch.",
    how: [
      "OpenFour’s ForwardVault clones CovenantLiteVault for each token that picks the template.",
      "The template settings (tap share, period, heartbeat, redeem fee) are fixed at creation.",
    ],
    addresses: [
      { label: "Our Lite template", address: "0xC9aD3B8aC5baD26278EFc8F88D1073eB85791437", chain: "bsc-testnet" },
      { label: "ForwardVault", address: "0xD3917AA849ec5122a4C0D48e054fa3B5514C47e4", chain: "bsc" },
    ],
    without: "Four.meme founders would have no covenant to opt into.",
  },
  {
    id: "cournot",
    name: "Cournot",
    logo: "/landing/logos/cournot.svg",
    x: 50,
    y: 88,
    flow: "Report check",
    status: "planned",
    statusText: "Planned: the vault’s verdict hook is built, the Cournot relayer is not",
    short: "A verdict on each period’s report (planned)",
    does: "A Cournot market would check each period report, and a failed check pauses the tap until a passing report lands.",
    how: ["The vault accepts recordVerdict from the relayer fixed at creation; no Cournot relayer is wired yet."],
    addresses: [],
    without: "Reports are still posted on-chain, but nobody checks them.",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    logo: "/landing/logos/bnb-chain.svg",
    x: 50,
    y: 11,
    flow: "Where it runs",
    status: "testnet",
    statusText: "Deployed on BNB testnet and verified on Sourcify; mainnet after Flap's factory audit",
    short: "Where every contract and every rule runs",
    does: "The launcher, the vault, the oracle and every rule are BNB Chain contracts. Agents, keepers and buyers all meet there.",
    how: ["Deploy.s.sol targets BNB testnet (97) and BNB Chain (56) and refuses any other chain."],
    addresses: [{ label: "Our CovenantLens", address: "0x6c0D9CDDCbAA497a54fF5aDDCbf444E77b3d1A83", chain: "bsc-testnet" }],
    without: "Nothing above exists without it.",
  },
];

export function explorerUrl(a: ChainAddress) {
  return `https://${a.chain === "bsc-testnet" ? "testnet." : ""}bscscan.com/address/${a.address}`;
}
