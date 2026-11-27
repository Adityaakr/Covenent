/**
 * What each integration does in Covenant, how we call it, the one fact that proves it and where it lives. Shared by
 * the home "How it's built" flow and the /features integrations grid. Every line is checked against the code, the
 * deployment record (contracts/deployments/97.json, the 27 Nov 2026 redeploy) and the runs in docs/DEPLOY.md
 * ("Flap's test launch on BNB testnet", where Flap's Portal launched $CVD on the current contracts). Statuses match
 * README.md ("Proven on chain", "Fork only") and JUDGES.md ("What is not done"). Nothing is on BNB Chain mainnet.
 * Cournot is not listed: only its verdict hook is designed; no relayer is integrated (as in the hero credits).
 * Citations: docs/landing/sources.md "How it's built".
 */
import { repoFile } from "@/lib/repo";

/** live = a live off-chain API; testnet = runs on BNB testnet; fork = proven on a BNB Chain mainnet fork. */
export type IntegrationStatus = "live" | "testnet" | "fork";
export type Chain = "bsc" | "bsc-testnet";
export type ChainAddress = { label: string; address: string; chain: Chain };

/** The tiny glyph beside each "how" step (sections/home/builtOnIcons.tsx). */
export type HowIcon = "launch" | "pool" | "vault" | "chart" | "shield" | "feed" | "sign" | "id" | "pen" | "api" | "bell" | "split" | "lock" | "clock" | "code" | "check" | "people";

export type Proof = { label: string; value: string; href: string };

export type Integration = {
  id: string;
  name: string;
  logo: string;
  /** the verb in the flow, for the step rail and the phone steps */
  step: string;
  status: IntegrationStatus;
  /** a second tag, e.g. what comes next */
  next?: string;
  /** exactly how far it is proven, one or two sentences */
  statusNote: string;
  /** one line for tiles */
  short: string;
  /** what it does for Covenant, one line */
  does: string;
  /** how, in three short steps */
  how: { icon: HowIcon; text: string }[];
  /** the one fact to check */
  proof: Proof[];
  contracts: ChainAddress[];
  /** superseded deployments, shown only inside the collapsed contracts list */
  previous?: ChainAddress[];
  without: string;
};

export const statusLabel: Record<IntegrationStatus, string> = {
  live: "Live API",
  testnet: "Live on testnet",
  fork: "Fork-tested",
};

export function explorerUrl(a: { address: string; chain: Chain }) {
  return `https://${a.chain === "bsc-testnet" ? "testnet." : ""}bscscan.com/address/${a.address}`;
}
export function txUrl(hash: string, chain: Chain = "bsc-testnet") {
  return `https://${chain === "bsc-testnet" ? "testnet." : ""}bscscan.com/tx/${hash}`;
}
const shortHex = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/* The current deployment on BNB testnet (contracts/deployments/97.json) and $CVD's launch (docs/DEPLOY.md). */
const T = "bsc-testnet" as const;
const PORTAL = "0x000042108465206185A077Edc3F3fd2b49060000";
const DOCK_ROUTER = "0x000048E888aBf09f690a952E1b386b2D031a0000";
const CVD = {
  token: "0xCD4CB77A6D970FDfddE04Ab9D9a89349995e7777",
  launcher: "0xFb40790832BBAF5ABe61Db0beEc575468c973045",
  vault: "0xFdC8dA0C251ED1f24cef6d9220aDa60E311638bE",
  pool: "0x464AF9543120B9a83Da2196BC6C3d1FC67E7860b",
  finalizeTx: "0x38170242eb34ebf1b449a16403fc270bd32892e3cd3ff3f8a2b9b6c589a09d2d",
  buyTx: "0x00cdbd9c1ea77af6c4835389d42b5fac70c291d71cd7a17a1d6031e5f443e729",
  pokeTx: "0x114078bc4d2abdfeec5c08206d348574b1859b7db76ea1790c9a7e1544c77b9e",
};
const ATLAS_BNB_USD = "0x3957d289ee9C38272377786787ea34F9dd29788D";
const LITE_TEMPLATE = "0x411c4560f9D8F9b06a730D9652FCb9D71290D285";
const LENS = "0x21DA47FC79DaF6479A1703aab1E5fc18B5bFa6b4";

export const integrations: Integration[] = [
  {
    id: "flap",
    name: "Flap Pool Launch",
    logo: "/landing/logos/flap.svg",
    step: "Raise and launch",
    status: "testnet",
    statusNote:
      "Flap’s testnet Portal launched $CVD on the current contracts. Tax reaching a vault is fork-tested: testnet volume never crossed Flap’s ~0.714 BNB processing threshold.",
    short: "Creates the token, seeds the pool, docks the reserved tokens and routes tax to the vault",
    does: "Takes the raise, launches the token and its pool, and fills the vault.",
    how: [
      { icon: "launch", text: "The team opens a covenant with Portal.newLauncher and our launcher factory." },
      { icon: "pool", text: "At finalize, Flap launches the tax token and seeds the pool at the sale price." },
      { icon: "vault", text: "Treasury, reserved tokens (Token Dock) and trading tax flow to the vault." },
    ],
    proof: [
      { label: "$CVD token", value: shortHex(CVD.token), href: explorerUrl({ address: CVD.token, chain: T }) },
      { label: "Launch tx", value: shortHex(CVD.finalizeTx), href: txUrl(CVD.finalizeTx) },
    ],
    contracts: [
      { label: "Flap Portal", address: PORTAL, chain: T },
      { label: "Flap TokenDockRouter", address: DOCK_ROUTER, chain: T },
      { label: "Our launcher factory", address: "0x528374FeF9da2C31C646E59AE19EB2aE18b7a0DF", chain: T },
      { label: "Our vault factory", address: "0xAbb9811f529B793c86848211522B789071671ebC", chain: T },
      { label: "Demo launcher factory (launched $CVD)", address: "0x0F92C58c6aC5A3f6A5E3fF23a7698F58306Df2aE", chain: T },
      { label: "Demo vault factory", address: "0x6d3a421708F8b45FbD92342d33a841de40E6cC8F", chain: T },
      { label: "$CVD launcher", address: CVD.launcher, chain: T },
      { label: "$CVD token", address: CVD.token, chain: T },
      { label: "$CVD vault", address: CVD.vault, chain: T },
    ],
    previous: [
      { label: "First demo factory (made $CVT)", address: "0x89D7E30109D62F72fBf717aafc2d59d21CA4DC48", chain: T },
      { label: "$CVT token", address: "0x40002FcB9983c46b299F13e2d64E2c9Cb3b07777", chain: T },
      { label: "$CVT vault", address: "0x524059B1424101D4CAFD33B9a1A8D332dD71193D", chain: T },
    ],
    without: "No raise, no launch and no tax coming into the treasury.",
  },
  {
    id: "pancakeswap",
    name: "PancakeSwap V2",
    logo: "/landing/logos/pancakeswap.svg",
    step: "Price the pool",
    status: "testnet",
    statusNote: "The $CVD pool was seeded at launch, traded both ways and read by a strict poke on BNB testnet.",
    short: "The pool, and the time-weighted price the exit reads on-chain",
    does: "The pool the token trades in, and the one price the exit compares with book value.",
    how: [
      { icon: "lock", text: "Flap seeds the pair at the sale price; all of the LP is burned." },
      { icon: "chart", text: "Each poke reads the pair’s cumulative price (price0/1CumulativeLast)." },
      { icon: "shield", text: "CovenantOracle turns it into a time-weighted price a flash loan cannot move." },
    ],
    proof: [
      { label: "$CVD pool", value: shortHex(CVD.pool), href: explorerUrl({ address: CVD.pool, chain: T }) },
      { label: "Buy tx", value: shortHex(CVD.buyTx), href: txUrl(CVD.buyTx) },
    ],
    contracts: [{ label: "$CVD / WBNB pool", address: CVD.pool, chain: T }],
    previous: [{ label: "$CVT / WBNB pool", address: "0x8ef1997E6D38A51Ad49459C8147f0E18fa0a4201", chain: T }],
    without: "Nothing to compare with book value, so no exit.",
  },
  {
    id: "atlas",
    name: "Atlas",
    logo: "/landing/logos/atlas.svg",
    step: "Price in dollars",
    status: "testnet",
    statusNote: "$CVD’s poke on BNB testnet read BNB/USD $553.15 from the Atlas push feed and counted as strict.",
    short: "Live BNB/USD for the dollar budget and dollar unlocks; never needed for the exit",
    does: "Live BNB/USD prices the dollar budget and the dollar unlocks. The exit never needs it.",
    how: [
      { icon: "feed", text: "CovenantOracle reads the push feed’s latestRoundData (18 decimals)." },
      { icon: "sign", text: "Signed Atlas pull reports are tried first when a signing key is set." },
      { icon: "shield", text: "Only strict observations (fresh price, pool at least half its seed) move the dollar rules." },
    ],
    proof: [
      { label: "BNB/USD feed", value: shortHex(ATLAS_BNB_USD), href: explorerUrl({ address: ATLAS_BNB_USD, chain: T }) },
      { label: "Strict poke tx", value: shortHex(CVD.pokeTx), href: txUrl(CVD.pokeTx) },
    ],
    contracts: [
      { label: "Atlas BNB/USD push feed", address: ATLAS_BNB_USD, chain: T },
      { label: "Our CovenantOracle", address: "0x2Df1Ad97fe98033Cc4Eba6Ea98B5703B0c69F775", chain: T },
    ],
    previous: [{ label: "CovenantOracle, first deployment", address: "0x3CC607931edaF307dC867111e48cAc28e31fF052", chain: T }],
    without: "The dollar rules freeze, then fall back in holders’ favour. The exit keeps working.",
  },
  {
    id: "erc8004",
    name: "ERC-8004",
    logo: "/landing/logos/erc-8004.svg",
    step: "Bind the agent",
    status: "fork",
    statusNote:
      "Fork-tested against the live BNB Chain registries. Our testnet factories point at the testnet registries; testnet holds no reputation write yet.",
    short: "Agent identity bound to the team wallet, outcomes on its reputation record",
    does: "Gives the issuer agent an identity, and its covenant outcomes a public reputation record.",
    how: [
      { icon: "id", text: "The launcher factory refuses an agentId the team wallet does not own." },
      { icon: "pen", text: "The vault records each outcome: an unlock, an abandonment, a wind-down." },
      { icon: "shield", text: "giveFeedback runs inside try/catch, so it can never block a rule." },
    ],
    proof: [
      {
        label: "Fork test",
        value: "Covenant.BSC.fork.t.sol",
        href: repoFile("contracts/test/fork/Covenant.BSC.fork.t.sol"),
      },
    ],
    contracts: [
      { label: "Identity registry", address: "0x8004A818BFB912233c491871b3d84c89A494BD9e", chain: T },
      { label: "Reputation registry", address: "0x8004B663056A597Dffe9eCcC1965A193B7388713", chain: T },
      { label: "Identity registry", address: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", chain: "bsc" },
      { label: "Reputation registry", address: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", chain: "bsc" },
    ],
    without: "An agent’s track record would not follow it into its next raise.",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    logo: "/landing/logos/bnb-chain.svg",
    step: "Run on\u2011chain",
    status: "testnet",
    statusNote: "Deployed and source-verified on BNB testnet (chain 97), unaudited. Nothing is on mainnet yet.",
    short: "Where every contract and every rule runs",
    does: "The base layer: the launcher, the vault, the oracle and every rule are BNB Chain contracts.",
    how: [
      { icon: "code", text: "Deploy.s.sol targets BNB testnet (97) and BNB Chain (56) and refuses any other chain." },
      { icon: "check", text: "Every contract of the current deployment is source-verified on Sourcify." },
      { icon: "people", text: "Agents, keepers and holders meet in the same contracts; anyone can trigger a rule." },
    ],
    proof: [
      { label: "CovenantLens", value: shortHex(LENS), href: explorerUrl({ address: LENS, chain: T }) },
      { label: "Test launch", value: "DEPLOY.md", href: `${repoFile("docs/DEPLOY.md")}#flaps-test-launch-on-bnb-testnet-27-nov-2026` },
    ],
    contracts: [{ label: "Our CovenantLens", address: LENS, chain: T }],
    without: "Nothing above exists without it.",
  },
  {
    id: "cmc",
    name: "CoinMarketCap",
    logo: "/landing/logos/coinmarketcap.svg",
    step: "Test the terms",
    status: "live",
    statusNote: "Runs in the Covenant server. The hosted site has no server attached, so it shows no live CMC quote.",
    short: "Real BNB Chain launches for the simulator; pair quotes and candles on the sheet",
    does: "Real BNB Chain launches to test terms against, before a covenant goes live.",
    how: [
      { icon: "chart", text: "/v1/k-line/candles: price history for the launch simulator." },
      { icon: "api", text: "/v4/dex/pairs/quotes/latest: the quote, holders and security scan on a sheet." },
      { icon: "bell", text: "Liquidity changes and token transactions: depth alerts, sellers in a round." },
    ],
    proof: [{ label: "Source", value: "server/src/api/cmc.ts", href: repoFile("server/src/api/cmc.ts") }],
    contracts: [],
    without: "The sheet still reads the chain, but the simulator has no real launches.",
  },
  {
    id: "four",
    name: "Four.meme",
    logo: "/landing/logos/four-meme.svg",
    step: "Coming next",
    status: "fork",
    next: "Coming to mainnet",
    statusNote:
      "Fork-tested against the live ForwardVault, which exists only on BNB Chain mainnet. The Lite template is deployed on BNB testnet.",
    short: "The Covenant Lite tax-vault template on OpenFour",
    does: "Covenant Lite for Four.meme tokens: the founder’s tax share goes to a vault with a capped draw.",
    how: [
      { icon: "split", text: "A token picks the template; OpenFour’s ForwardVault clones CovenantLiteVault for it." },
      { icon: "lock", text: "Tap share, period, heartbeat and redeem fee are fixed at creation." },
      { icon: "clock", text: "If the founder goes silent, holders redeem pro rata." },
    ],
    proof: [
      { label: "Lite template", value: shortHex(LITE_TEMPLATE), href: explorerUrl({ address: LITE_TEMPLATE, chain: T }) },
    ],
    contracts: [
      { label: "Our Lite template", address: LITE_TEMPLATE, chain: T },
      { label: "OpenFour ForwardVault", address: "0xD3917AA849ec5122a4C0D48e054fa3B5514C47e4", chain: "bsc" },
    ],
    without: "Four.meme founders would have no covenant to opt into.",
  },
];
