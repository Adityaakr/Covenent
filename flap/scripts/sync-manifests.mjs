#!/usr/bin/env node
// Writes the chain id and factory addresses in flap/launcher-ui/manifest.json and flap/vault-ui/manifest.json from
// the deployment record, so no address is typed by hand. `--check` only reports drift (exit 1).
//
//   node flap/scripts/sync-manifests.mjs [--check] [--deployment contracts/deployments/97.json] [--test-token 0x…7777]
//
// The Vault UI manifest also names one real deployed token ending in 7777 (Flap's E2E acceptance token, not a CA
// restriction). It is kept unless --test-token replaces it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const check = args.includes("--check");
const deploymentPath = path.resolve(root, flag("--deployment") ?? process.env.COVENANT_DEPLOYMENTS ?? "contracts/deployments/97.json");
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

function expected(dep) {
  const address = key => {
    const value = dep[key];
    if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`${key} missing from the deployment record`);
    return value.toLowerCase();
  };
  return { chainId: dep.chainId, launcherFactory: address("launcherFactory"), vaultFactory: address("vaultFactory") };
}

const want = expected(deployment);
const launcherFile = path.join(root, "flap/launcher-ui/manifest.json");
const vaultFile = path.join(root, "flap/vault-ui/manifest.json");
const launcher = JSON.parse(fs.readFileSync(launcherFile, "utf8"));
const vault = JSON.parse(fs.readFileSync(vaultFile, "utf8"));
const binding = vault.match.bindings[0];
const testToken = flag("--test-token")?.toLowerCase() ?? binding.tokenAddresses?.[0];
if (!testToken || !/^0x[0-9a-f]{36}7777$/.test(testToken)) throw new Error("the Vault UI needs a real deployed test token ending in 7777 (--test-token)");

const drift = [];
if (launcher.chainId !== want.chainId) drift.push(`launcher chainId ${launcher.chainId} -> ${want.chainId}`);
if (launcher.factoryAddress !== want.launcherFactory) drift.push(`launcher factory ${launcher.factoryAddress} -> ${want.launcherFactory}`);
if (binding.chainId !== want.chainId) drift.push(`vault chainId ${binding.chainId} -> ${want.chainId}`);
if (binding.factoryAddress !== want.vaultFactory) drift.push(`vault factory ${binding.factoryAddress} -> ${want.vaultFactory}`);
if (binding.tokenAddresses?.[0] !== testToken) drift.push(`vault test token ${binding.tokenAddresses?.[0]} -> ${testToken}`);

if (check) {
  if (drift.length) { console.error(`manifests differ from ${path.relative(root, deploymentPath)}:\n  ${drift.join("\n  ")}`); process.exit(1); }
  console.log(`manifests match ${path.relative(root, deploymentPath)}`);
} else {
  launcher.chainId = want.chainId;
  launcher.factoryAddress = want.launcherFactory;
  binding.chainId = want.chainId;
  binding.factoryAddress = want.vaultFactory;
  binding.tokenAddresses = [testToken];
  fs.writeFileSync(launcherFile, JSON.stringify(launcher, null, 2) + "\n");
  fs.writeFileSync(vaultFile, JSON.stringify(vault, null, 2) + "\n");
  console.log(drift.length ? `updated:\n  ${drift.join("\n  ")}` : "already in sync");
}
