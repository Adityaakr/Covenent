#!/usr/bin/env node
// Writes the chain id and factory addresses of both package sets from the deployment record, so no address is typed
// by hand. `--check` only reports drift (exit 1).
//
//   node flap/scripts/sync-manifests.mjs [--check] [--deployment contracts/deployments/97.json]
//                                        [--test-token 0x…7777] [--demo-test-token 0x…7777]
//
// Two sets, same Component.tsx / i18n.json / VaultABI.ts, different manifests and artifact ids:
//   production  flap/launcher-ui/manifest.json, flap/vault-ui/manifest.json  (launcherFactory, vaultFactory)
//   demo        flap/demo/launcher-ui.manifest.json, flap/demo/vault-ui.manifest.json  (demoLauncherFactory,
//               demoVaultFactory: the short-timer profile, used for Flap's test launch)
// The demo Launcher manifest copies its reads and transactions from the production one. Each Vault UI manifest also
// names one real deployed token ending in 7777 (Flap's E2E acceptance token, not a CA restriction); it is kept
// unless --test-token / --demo-test-token replaces it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const check = args.includes("--check");
const deploymentPath = path.resolve(root, flag("--deployment") ?? process.env.COVENANT_DEPLOYMENTS ?? "contracts/deployments/97.json");
const dep = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

const address = key => {
  const value = dep[key];
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${key} missing from the deployment record`);
  return value.toLowerCase();
};

const sets = [
  { name: "production", launcherFile: "flap/launcher-ui/manifest.json", vaultFile: "flap/vault-ui/manifest.json",
    launcherFactory: address("launcherFactory"), vaultFactory: address("vaultFactory"), tokenFlag: "--test-token" },
  { name: "demo", launcherFile: "flap/demo/launcher-ui.manifest.json", vaultFile: "flap/demo/vault-ui.manifest.json",
    launcherFactory: address("demoLauncherFactory"), vaultFactory: address("demoVaultFactory"), tokenFlag: "--demo-test-token" },
];
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const production = read(sets[0].launcherFile);

const drift = [];
const writes = [];
for (const set of sets) {
  const launcher = read(set.launcherFile);
  const vault = read(set.vaultFile);
  const binding = vault.match.bindings[0];
  const testToken = flag(set.tokenFlag)?.toLowerCase() ?? binding.tokenAddresses?.[0];
  if (!testToken || !/^0x[0-9a-f]{36}7777$/.test(testToken)) {
    throw new Error(`the ${set.name} Vault UI needs a real deployed test token ending in 7777 (${set.tokenFlag})`);
  }
  const say = (what, from, to) => { if (JSON.stringify(from) !== JSON.stringify(to)) drift.push(`${set.name} ${what}: ${JSON.stringify(from)} -> ${JSON.stringify(to)}`); };
  say("launcher chainId", launcher.chainId, dep.chainId);
  say("launcher factory", launcher.factoryAddress, set.launcherFactory);
  say("vault chainId", binding.chainId, dep.chainId);
  say("vault factory", binding.factoryAddress, set.vaultFactory);
  say("vault test token", binding.tokenAddresses?.[0], testToken);
  if (set.name !== "production") {
    say("launcher reads", launcher.reads, production.reads);
    say("launcher transactions", launcher.transactions, production.transactions);
    launcher.reads = production.reads;
    launcher.transactions = production.transactions;
  }
  launcher.chainId = dep.chainId;
  launcher.factoryAddress = set.launcherFactory;
  binding.chainId = dep.chainId;
  binding.factoryAddress = set.vaultFactory;
  binding.tokenAddresses = [testToken];
  writes.push([set.launcherFile, launcher], [set.vaultFile, vault]);
}

if (check) {
  if (drift.length) { console.error(`manifests differ from ${path.relative(root, deploymentPath)}:\n  ${drift.join("\n  ")}`); process.exit(1); }
  console.log(`manifests match ${path.relative(root, deploymentPath)}`);
} else {
  for (const [file, json] of writes) fs.writeFileSync(path.join(root, file), JSON.stringify(json, null, 2) + "\n");
  console.log(drift.length ? `updated:\n  ${drift.join("\n  ")}` : "already in sync");
}
