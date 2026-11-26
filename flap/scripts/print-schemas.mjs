#!/usr/bin/env node
// Prints what flap.sh's default pages read from the deployed contracts: the launcher factory's launcherDataSchema()
// (creation form), the vault factory's vaultDataSchema() and tokenCreationPolicies(), the vault's vaultUISchema()
// (default vault page, read from the factory's beacon implementation) and, for each launcher given, description().
//
//   node flap/scripts/print-schemas.mjs [--rpc <url>] [--deployment contracts/deployments/97.json] [--launcher 0x…]...
//
// Addresses come from the deployment record; ABIs from contracts/abi. Uses server/node_modules (viem).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { createPublicClient, http } = createRequire(path.join(root, "server/package.json"))("viem");
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const rpc = flag("--rpc") ?? process.env.BSC_TESTNET_RPC_URL;
if (!rpc) { console.error("pass --rpc or set BSC_TESTNET_RPC_URL"); process.exit(2); }
const dep = JSON.parse(fs.readFileSync(path.resolve(root, flag("--deployment") ?? "contracts/deployments/97.json"), "utf8"));
const abi = name => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, "contracts/abi", `${name}.json`), "utf8"));
  return Array.isArray(raw) ? raw : raw.abi;
};
const client = createPublicClient({ transport: http(rpc) });
const read = (address, name, functionName, a = []) => client.readContract({ address, abi: abi(name), functionName, args: a });
const json = value => JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);

const fields = list => list.map(f => `    ${f.name.padEnd(18)} ${f.fieldType.padEnd(9)} decimals=${f.decimals}  ${f.description}`).join("\n");

const chainId = await client.getChainId();
console.log(`chain ${chainId}, launcher factory ${dep.launcherFactory}, vault factory ${dep.vaultFactory}\n`);

const ls = await read(dep.launcherFactory, "CovenantLauncherFactory", "launcherDataSchema");
console.log(`launcherDataSchema() — isArray=${ls.isArray}\n  ${ls.description}\n${fields(ls.fields)}\n`);
console.log(`factorySpecVersion() = ${await read(dep.launcherFactory, "CovenantLauncherFactory", "factorySpecVersion")}\n`);

const vs = await read(dep.vaultFactory, "CovenantVaultFactory", "vaultDataSchema");
console.log(`vaultDataSchema() — isArray=${vs.isArray}\n  ${vs.description}\n${fields(vs.fields)}\n`);
const policies = await read(dep.vaultFactory, "CovenantVaultFactory", "tokenCreationPolicies");
console.log(`tokenCreationPolicies()\n${policies.map(p => `    ${p.target} ${p.operator} ${p.value}  ${p.description}`).join("\n")}\n`);

const impl = await read(dep.vaultFactory, "CovenantVaultFactory", "beaconImplementation");
const ui = await read(impl, "CovenantVault", "vaultUISchema");
console.log(`vaultUISchema() (implementation ${impl}) — ${ui.vaultType}\n  ${ui.description}`);
for (const m of ui.methods) {
  const io = [m.inputs.length ? `in: ${m.inputs.map(f => `${f.name}:${f.fieldType}`).join(", ")}` : "",
    m.outputs.length ? `out: ${m.outputs.map(f => `${f.name}:${f.fieldType}/${f.decimals}`).join(", ")}` : "",
    m.approvals.length ? `approve: ${m.approvals.map(a => `${a.tokenType}(${a.amountFieldName})`).join(", ")}` : ""].filter(Boolean).join("; ");
  console.log(`  ${m.isWriteMethod ? "write" : "view "} ${m.name.padEnd(20)} ${io}\n        ${m.description}`);
}

for (const launcher of args.flatMap((a, i) => (args[i - 1] === "--launcher" ? [a] : []))) {
  const d = await read(launcher, "CovenantLauncher", "description");
  console.log(`\ndescription() of ${launcher} (${Buffer.byteLength(d)} bytes)\n${json(JSON.parse(d))}`);
}
