// node --test flap/test
// Checks the flap.sh packages against the contracts and the deployment record. No dependencies beyond Node and unzip.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const flap = (...p) => path.join(root, "flap", ...p);
const readJson = p => JSON.parse(fs.readFileSync(p, "utf8"));
const abi = name => { const raw = readJson(path.join(root, "contracts/abi", `${name}.json`)); return Array.isArray(raw) ? raw : raw.abi; };
const fn = (entries, name) => entries.filter(e => e.type === "function" && e.name === name);

// Getters the Launcher UI reads that may be missing from the ABI (the host then shows them as unavailable). The
// re-review's minRaise(), cap() and expectedToken() are exported now, so none.
const PENDING_LAUNCHER_GETTERS = new Set();

const launcherManifest = readJson(flap("launcher-ui/manifest.json"));
const vaultManifest = readJson(flap("vault-ui/manifest.json"));

test("manifests carry the chain and factories of the deployment record", () => {
  execFileSync(process.execPath, [flap("scripts/sync-manifests.mjs"), "--check"], { stdio: "pipe" });
  assert.equal(launcherManifest.configContract, "launcher-detail/v1");
  assert.deepEqual(launcherManifest.surfaces, ["launcher-ui"]);
  const binding = vaultManifest.match.bindings[0];
  assert.equal(vaultManifest.match.bindings.length, 1);
  assert.match(binding.tokenAddresses[0], /^0x[0-9a-f]{36}7777$/);
});

test("every Launcher read is a getter of CovenantLauncher with the declared shape", () => {
  const entries = abi("CovenantLauncher");
  const reads = Object.entries(launcherManifest.reads);
  assert.ok(reads.length <= 16, "Flap allows at most 16 reads with transactions");
  const missing = [];
  for (const [key, read] of reads) {
    const matches = fn(entries, read.functionName);
    if (!matches.length) { missing.push(read.functionName); continue; }
    const want = read.account ? ["address"] : [];
    const f = matches.find(m => JSON.stringify(m.inputs.map(i => i.type)) === JSON.stringify(want));
    assert.ok(f, `${key}: ${read.functionName}(${want}) not in the ABI`);
    assert.ok(["view", "pure"].includes(f.stateMutability), `${key}: not a view`);
    assert.equal(f.outputs.length, 1, `${key}: one return value`);
    const out = f.outputs[0].type;
    const ok = read.returns === "uint256" ? /^uint(8|16|32|64|128|256)$/.test(out) : out === read.returns;
    assert.ok(ok, `${key}: returns ${out}, manifest says ${read.returns}`);
  }
  for (const name of missing) assert.ok(PENDING_LAUNCHER_GETTERS.has(name), `${name} is not a CovenantLauncher getter`);
  if (missing.length) console.log(`  pending in contracts/abi/CovenantLauncher.json: ${missing.join(", ")}`);
});

test("every Launcher action is a zero-argument CovenantLauncher function with the declared mutability", () => {
  const entries = abi("CovenantLauncher");
  const actions = Object.entries(launcherManifest.transactions.actions);
  assert.ok(actions.length >= 1 && actions.length <= 8);
  for (const [name, mutability] of actions) {
    const f = fn(entries, name).find(m => m.inputs.length === 0);
    assert.ok(f, `${name}() not in the ABI`);
    assert.equal(f.stateMutability, mutability, `${name} is ${f.stateMutability}`);
  }
  const source = fs.readFileSync(flap("launcher-ui/Component.tsx"), "utf8");
  const typed = source.match(/type Action = ([^;]+);/)[1].match(/"(\w+)"/g).map(s => s.slice(1, -1));
  assert.deepEqual(typed.sort(), actions.map(([n]) => n).sort(), "Component Action type matches the manifest");
});

test("VaultABI.ts fragments match CovenantVault", () => {
  const entries = abi("CovenantVault");
  const text = fs.readFileSync(flap("vault-ui/VaultABI.ts"), "utf8");
  const fragments = [...text.matchAll(/"function (\w+)\(([^)]*)\)([^"]*)"/g)];
  assert.ok(fragments.length > 10);
  for (const [, name, params, rest] of fragments) {
    const types = params.split(",").map(p => p.trim().split(/\s+/)[0]).filter(Boolean);
    const f = fn(entries, name).find(m => JSON.stringify(m.inputs.map(i => i.type)) === JSON.stringify(types));
    assert.ok(f, `${name}(${types}) not in CovenantVault`);
    const isView = /\bview\b|\bpure\b/.test(rest);
    assert.equal(["view", "pure"].includes(f.stateMutability), isView, `${name}: mutability`);
    const outs = (rest.match(/returns \((.*)\)/)?.[1] ?? "").split(",").map(p => p.trim().split(/\s+/)[0]).filter(Boolean);
    assert.deepEqual(outs, f.outputs.map(o => o.type), `${name}: return types`);
  }
});

test("vault methods named in the Vault UI's calls are all in VaultABI.ts", () => {
  const source = fs.readFileSync(flap("vault-ui/Component.tsx"), "utf8");
  const abiText = fs.readFileSync(flap("vault-ui/VaultABI.ts"), "utf8");
  const named = new Set([...source.matchAll(/read<[^>]+>\("(\w+)"/g), ...source.matchAll(/send\("\w+", "(\w+)"/g)].map(m => m[1]));
  named.delete("approve"); // ERC-20 approve on the token, through the SDK's erc20Abi
  for (const name of named) assert.match(abiText, new RegExp(`function ${name}\\(`), `${name} missing from VaultABI.ts`);
});

test("translations: same keys in en, zh and ko, and every key the components use exists", () => {
  for (const [dir, pattern] of [["launcher-ui", /\bm\.(\w+)/g], ["vault-ui", /\bt\("([\w.]+)"\)/g]]) {
    const i18n = readJson(flap(dir, "i18n.json"));
    const en = Object.keys(i18n.en).sort();
    for (const locale of ["zh", "ko"]) assert.deepEqual(Object.keys(i18n[locale]).sort(), en, `${dir} ${locale} keys`);
    for (const locale of Object.keys(i18n)) for (const v of Object.values(i18n[locale])) assert.ok(v.trim(), `${dir} ${locale} empty message`);
    const source = fs.readFileSync(flap(dir, "Component.tsx"), "utf8");
    const used = new Set([...source.matchAll(pattern)].map(m => m[1]));
    if (dir === "vault-ui") for (const m of source.matchAll(/"(states\.\w+)"/g)) used.add(m[1]);
    for (const key of used) assert.ok(en.includes(key), `${dir}: missing message ${key}`);
  }
});

test("the demo set differs from production only in artifact id, name and factory", () => {
  const demoLauncher = readJson(flap("demo/launcher-ui.manifest.json"));
  const demoVault = readJson(flap("demo/vault-ui.manifest.json"));
  const strip = ({ artifactId, name, factoryAddress, ...rest }) => rest;
  assert.deepEqual(strip(demoLauncher), strip(launcherManifest));
  assert.notEqual(demoLauncher.artifactId, launcherManifest.artifactId);
  assert.notEqual(demoLauncher.factoryAddress, launcherManifest.factoryAddress);
  assert.match(demoVault.artifactId, /^vaultui_covenant-vault-demo_[0-9A-Z]{26}$/);
  assert.notEqual(demoVault.match.bindings[0].factoryAddress, vaultManifest.match.bindings[0].factoryAddress);
  assert.deepEqual(demoVault.i18n, vaultManifest.i18n);
});

test("committed packages match SHA256SUMS and the sources in this folder", () => {
  const sums = fs.readFileSync(flap("packages/SHA256SUMS"), "utf8").trim().split("\n").map(l => l.split(/\s+/));
  assert.deepEqual(sums.map(([, f]) => f).sort(),
    ["covenant-launcher-ui-demo.zip", "covenant-launcher-ui.zip", "covenant-vault-ui-demo.zip", "covenant-vault-ui.zip"]);
  for (const [sha, file] of sums) {
    const bytes = fs.readFileSync(flap("packages", file));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), sha, file);
  }
  const unzip = (zip, entry) => execFileSync("unzip", ["-p", flap("packages", zip), entry]);
  const same = (zip, entry, file) => assert.ok(unzip(zip, entry).equals(fs.readFileSync(file)), `${zip} ${entry} is stale`);
  for (const [zip, manifest] of [["covenant-launcher-ui.zip", flap("launcher-ui/manifest.json")],
    ["covenant-launcher-ui-demo.zip", flap("demo/launcher-ui.manifest.json")]]) {
    for (const f of ["Component.tsx", "i18n.json"]) same(zip, f, flap("launcher-ui", f));
    same(zip, "manifest.json", manifest);
  }
  for (const [zip, folder, manifest] of [["covenant-vault-ui.zip", "covenant-vault", flap("vault-ui/manifest.json")],
    ["covenant-vault-ui-demo.zip", "covenant-vault-demo", flap("demo/vault-ui.manifest.json")]]) {
    for (const f of ["Component.tsx", "VaultABI.ts", "i18n.json"]) same(zip, `src/vaults/${folder}/${f}`, flap("vault-ui", f));
    same(zip, `src/vaults/${folder}/manifest.json`, manifest);
  }
});
