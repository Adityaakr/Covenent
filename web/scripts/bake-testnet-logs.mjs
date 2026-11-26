// Bakes the event history of every known BNB testnet covenant into the web bundle (src/generated/testnet-logs.json):
// each launcher's and vault's logs, Demo USDC transfers, and the times of their blocks. Public testnet RPCs cannot
// serve this history to a browser in one query (see src/lib/chain/logs.ts), so the page starts from this snapshot
// and reads only the blocks after it. Incremental: it continues from the committed snapshot's last block.
// Runs before `next build`, after bake-testnet.mjs. Any network failure keeps the committed file; the build goes on.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http } from "viem";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payloadFile = path.join(web, "src", "generated", "testnet.json");
const out = path.join(web, "src", "generated", "testnet-logs.json");
const LOG_RPC = process.env.NEXT_PUBLIC_BSC_TESTNET_LOG_RPC || "https://bsc-prebsc-dataseed.bnbchain.org"; // full history, 5,000-block ranges
const READ_RPC = "https://bsc-testnet-rpc.publicnode.com";
const STEP = 5_000n;
const DEADLINE = Date.now() + 120_000;

const keep = (why) => { console.log(`[bake-testnet-logs] ${why}; keeping ${path.relative(web, out)}`); process.exit(0); };
if (process.env.COVENANT_SKIP_LOG_BAKE === "1") keep("COVENANT_SKIP_LOG_BAKE=1");

const payload = JSON.parse(readFileSync(payloadFile, "utf8"));
const d = payload.deployment;
const start = BigInt(d.startBlock);
const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
const usable = prev && prev.chainId === d.chainId && prev.startBlock === String(start) ? prev : null;

const reader = createPublicClient({ transport: http(READ_RPC, { timeout: 15_000, retryCount: 2 }) });
const logs = createPublicClient({ transport: http(LOG_RPC, { timeout: 20_000, retryCount: 3, retryDelay: 600 }) });
const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const abi = (name) => payload.abis[name];

try {
  // The covenants the app lists: launchers named in the deployment, plus every launcher the factories created.
  const named = Object.entries(d.addresses).filter(([k, v]) => isAddr(v) && /launcher/i.test(k) && !/factory|four|lite/i.test(k)).map(([, v]) => v);
  // every covenant launcher factory the record names, current and earlier (the web's discover.ts reads the same set)
  const factories = [...new Set(Object.entries(d.addresses).filter(([k, v]) => /launcherfactory$/i.test(k) && !/four|lite/i.test(k) && isAddr(v)).map(([, v]) => v))];
  const made = (await Promise.all(factories.map((f) => reader.readContract({ address: f, abi: abi("CovenantLauncherFactory"), functionName: "allLaunchers" }).catch(() => [])))).flat();
  const launchers = [...new Map([...named, ...made].map((a) => [a.toLowerCase(), a])).values()];
  const vaults = (await Promise.all(launchers.map((l) => reader.readContract({ address: l, abi: abi("CovenantLauncher"), functionName: "vault" }).catch(() => null))))
    .filter((v) => isAddr(v) && !/^0x0{40}$/i.test(v));
  const targets = [...launchers, ...vaults, ...(isAddr(d.addresses.demoUsdc) ? [d.addresses.demoUsdc] : [])].map((a) => a.toLowerCase());

  const head = await reader.getBlockNumber();
  const contracts = {};
  const times = { ...(usable?.times ?? {}) };
  for (const a of targets) {
    const had = usable?.contracts?.[a];
    let from = had ? BigInt(usable.toBlock) + 1n : start;
    const rows = had ? [...had.logs] : [];
    for (; from <= head; from += STEP) {
      if (Date.now() > DEADLINE) keep("out of time");
      const to = from + STEP - 1n > head ? head : from + STEP - 1n;
      const got = await logs.getLogs({ address: a, fromBlock: from, toBlock: to });
      for (const l of got) rows.push([l.blockNumber.toString(), l.transactionHash, l.logIndex, l.topics, l.data]);
    }
    contracts[a] = { fromBlock: String(start), logs: rows };
  }
  // the time of every block that has one of these logs, so the page needs no getBlock for history
  const need = [...new Set(Object.values(contracts).flatMap((c) => c.logs.map((r) => r[0])))].filter((b) => times[b] === undefined);
  for (let i = 0; i < need.length; i += 20) {
    const blocks = await Promise.all(need.slice(i, i + 20).map((b) => reader.getBlock({ blockNumber: BigInt(b) })));
    for (const b of blocks) times[b.number.toString()] = Number(b.timestamp);
  }
  const snap = { chainId: d.chainId, startBlock: String(start), toBlock: head.toString(), times, contracts };
  writeFileSync(out, JSON.stringify(snap) + "\n");
  const n = Object.values(contracts).reduce((s, c) => s + c.logs.length, 0);
  console.log(`[bake-testnet-logs] wrote ${path.relative(web, out)}: ${targets.length} contracts, ${n} logs, blocks ${start}-${head}`);
} catch (e) {
  keep(`could not read the chain (${String(e?.shortMessage ?? e?.message ?? e).split("\n")[0]})`);
}
