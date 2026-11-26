#!/usr/bin/env node
// Renders flap/launcher-ui/Component.tsx the way Flap's Launcher host does (props { context, messages, host }) into one
// static HTML page per locale, for a visual check: Flap's template has no local preview for launcher-detail/v1.
//
//   node flap/scripts/render-launcher.mjs <out-dir> [--rpc <url>] [--manifest flap/demo/launcher-ui.manifest.json]
//                                         [--launcher 0x…]...
//
// Every value on the page comes from a real Launcher: for each --launcher it reads the manifest's getters on chain,
// exactly as the host does (a failing getter or a zero address becomes null), and renders that snapshot with and
// without the wallet bridge. With no --launcher it renders the empty and loading states only.
// Uses web/node_modules (react, react-dom, typescript) and server/node_modules (viem); install those packages first.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webRequire = createRequire(path.join(root, "web/package.json"));
const serverRequire = createRequire(path.join(root, "server/package.json"));
const ts = webRequire("typescript");
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");

const args = process.argv.slice(2);
const outDir = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
if (!outDir) {
  console.error("usage: render-launcher.mjs <out-dir> [--launcher 0x… --rpc <url>]");
  process.exit(2);
}

const dir = path.join(root, "flap/launcher-ui");
const manifestPath = flag("--manifest") ? path.resolve(flag("--manifest")) : path.join(dir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const i18n = JSON.parse(fs.readFileSync(path.join(dir, "i18n.json"), "utf8"));
const source = fs.readFileSync(path.join(dir, "Component.tsx"), "utf8");

// Compile the component to CommonJS and load it with web's React.
const js = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", js)(webRequire, mod, mod.exports);
const { Launcher } = mod.exports;

async function liveSnapshot(launcher, rpc) {
  const { createPublicClient, http, parseAbi } = serverRequire("viem");
  const client = createPublicClient({ transport: http(rpc) });
  const snapshot = {};
  for (const [key, read] of Object.entries(manifest.reads)) {
    if (read.account) { snapshot[key] = null; continue; }
    const abi = parseAbi([`function ${read.functionName}() view returns (${read.returns})`]);
    try {
      const value = await client.readContract({ address: launcher, abi, functionName: read.functionName });
      snapshot[key] = typeof value === "bigint" ? value.toString()
        : typeof value === "string" ? (/^0x0{40}$/i.test(value) ? null : value.toLowerCase()) : value;
    } catch {
      snapshot[key] = null;
    }
  }
  return snapshot;
}

const noop = () => {};
const bridge = account => ({
  available: true,
  wallet: { account, chainId: manifest.chainId, pendingHash: null, connect: noop, switchChain: async () => {} },
  submit: async () => ({ status: "pending", hash: "0x" + "0".repeat(64) }),
  checkReceipt: async hash => ({ status: "pending", hash }),
  refresh: noop,
  redirect: () => true,
});

const launchers = args.flatMap((a, i) => (args[i - 1] === "--launcher" ? [a] : []));
const rpc = flag("--rpc") ?? process.env.BSC_TESTNET_RPC_URL;
const scenarios = [];
const identity = { chainId: manifest.chainId, factoryAddress: manifest.factoryAddress };
scenarios.push({ title: "No Launcher selected (artifact preview)", context: { identity, launcherAddress: null, snapshot: null } });
fs.mkdirSync(outDir, { recursive: true });
const snapshots = {};
for (const launcher of launchers) {
  if (!rpc) { console.error("--launcher needs --rpc or BSC_TESTNET_RPC_URL"); process.exit(2); }
  const snapshot = await liveSnapshot(launcher, rpc);
  snapshots[launcher.toLowerCase()] = snapshot;
  const context = { identity, launcherAddress: launcher.toLowerCase(), snapshot };
  scenarios.push({ title: `Launcher ${launcher}: loading`, context: { ...context, snapshot: null }, host: bridge(null) });
  scenarios.push({ title: `Launcher ${launcher}: read-only host (no wallet bridge)`, context, host: { available: false, redirect: () => true } });
  scenarios.push({ title: `Launcher ${launcher}: wallet bridge, no wallet connected`, context, host: bridge(null) });
}
fs.writeFileSync(path.join(outDir, "snapshots.json"), JSON.stringify(snapshots, null, 2) + "\n");
for (const locale of Object.keys(i18n)) {
  const body = scenarios.map(s => {
    const html = renderToStaticMarkup(React.createElement(Launcher, {
      context: { ...s.context, locale }, messages: i18n[locale], host: s.host,
    }));
    return `<h1 style="font:600 14px system-ui;color:#999;margin:28px 0 10px">${s.title}</h1>${html}`;
  }).join("\n");
  const page = `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Covenant Launcher UI (${locale})</title><body style="margin:0;padding:16px;background:#0b0d11;max-width:760px">${body}</body></html>`;
  const file = path.join(outDir, `launcher-${locale}.html`);
  fs.writeFileSync(file, page);
  console.log(pathToFileURL(file).href);
}
