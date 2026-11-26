// Bakes the BNB testnet deployment into the web bundle: contracts/deployments/97.json (Deploy.s.sol's record), the
// Atlas push feeds and the public ABIs, in the shape /api/deployment serves locally. The output is committed, so a
// host that builds only web/ (Vercel, root directory web) needs no contracts/ checkout and no environment variables.
// Runs before `next build`; without ../contracts it keeps the committed file.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contracts = path.resolve(web, "..", "contracts");
const out = path.join(web, "src", "generated", "testnet.json");
const record = path.join(contracts, "deployments", "97.json");
if (!existsSync(record)) {
  console.log(`[bake-testnet] ${record} not found; keeping ${path.relative(web, out)}`);
  process.exit(0);
}

const r = JSON.parse(readFileSync(record, "utf8"));
const atlas = JSON.parse(readFileSync(path.join(contracts, "config", "atlas-97.json"), "utf8"));
const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const addresses = Object.fromEntries(Object.entries(r).filter(([, v]) => isAddr(v)));
Object.assign(addresses, {
  taxTokenImpl: "0x7777c57ff7dc441c1715b2e36fa581c48B782222",
  wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
  router: "0xc9D63ddCB9549578057EAB6A83a543DdFEE2b8c3",
  atlasPushBnbUsd: atlas.pushFeeds["BNB/USD"],
});

// Only contracts that exist on BNB testnet: no mocks, no dev-chain stand-ins. DemoUSDC is deployed on testnet too
// (script/DemoUSDC.s.sol, test funds for the agent economy demo), so its ABI ships when 97.json names it.
const LOCAL_ONLY = r.demoUsdc ? /^(Mock|FourLiteLauncher|FourStyleTaxToken)/ : /^(Mock|DemoUSDC|FourLiteLauncher|FourStyleTaxToken)/;
const abiDir = path.join(contracts, "abi");
const abis = {};
for (const f of readdirSync(abiDir).sort()) {
  if (!f.endsWith(".json") || LOCAL_ONLY.test(f)) continue;
  const j = JSON.parse(readFileSync(path.join(abiDir, f), "utf8"));
  abis[f.replace(/\.json$/, "")] = Array.isArray(j) ? j : j.abi;
}

const baked = {
  status: "ok",
  dir: "baked",
  problems: [],
  deployment: {
    chainId: 97,
    rpcUrl: "https://bsc-testnet-rpc.publicnode.com",
    startBlock: 144956048, // first block of the deployment (Deploy.s.sol broadcast)
    mode: "testnet",
    addresses,
    demo: {},
    atlas: { pushFeeds: atlas.pushFeeds },
  },
  abis,
};
writeFileSync(out, JSON.stringify(baked) + "\n");

// The simulator's last computed result (real launches), served as a static file so it needs no server.
const sim = path.resolve(web, "..", "server", "data", "simulator", "latest.json");
if (existsSync(sim)) {
  mkdirSync(path.join(web, "public", "data"), { recursive: true });
  copyFileSync(sim, path.join(web, "public", "data", "simulator-latest.json"));
}
console.log(`[bake-testnet] wrote ${path.relative(web, out)}: ${Object.keys(addresses).length} addresses, ${Object.keys(abis).length} ABIs`);
