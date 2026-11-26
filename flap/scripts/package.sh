#!/usr/bin/env bash
# Build both flap.sh package sets with Flap's own tooling and copy them to flap/packages/ with their SHA-256.
#
#   FLAP_TEMPLATE_DIR=/path/to/flap-vault-component-template flap/scripts/package.sh [--vault 0x…] [--demo-vault 0x…]
#
#   production  covenant-launcher-ui.zip, covenant-vault-ui.zip            (launcherFactory, vaultFactory)
#   demo        covenant-launcher-ui-demo.zip, covenant-vault-ui-demo.zip  (demoLauncherFactory, demoVaultFactory)
# Both sets share flap/launcher-ui/{Component.tsx,i18n.json} and flap/vault-ui/{Component.tsx,VaultABI.ts,i18n.json};
# only the manifests (factory address, artifact id) differ.
#
# FLAP_TEMPLATE_DIR is a clean checkout of github.com/flap-sh/flap-vault-component-template on `main` (Flap's
# packaging refuses a checkout that is not exactly origin/main), with `yarn install --frozen-lockfile` and
# `yarn playwright install chromium` done. --vault / --demo-vault pass the vault of each manifest's test token to
# vault:e2e, so the screenshots show live reads (the template's preview cannot always resolve the vault by itself).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
tpl="${FLAP_TEMPLATE_DIR:?set FLAP_TEMPLATE_DIR to a flap-vault-component-template checkout on main}"
prod_vault="" demo_vault=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vault) prod_vault="${2:?--vault needs an address}"; shift 2 ;;
    --demo-vault) demo_vault="${2:?--demo-vault needs an address}"; shift 2 ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
done
out="$root/flap/packages"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

node "$root/flap/scripts/sync-manifests.mjs" --check

# build_vault <template folder> <manifest> <vault for e2e or ""> <output zip>
build_vault() {
  local folder="$1" manifest="$2" vault="$3" zip="$4"
  mkdir -p "$tpl/src/vaults/$folder"
  cp "$root"/flap/vault-ui/{Component.tsx,VaultABI.ts,i18n.json} "$tpl/src/vaults/$folder/"
  cp "$manifest" "$tpl/src/vaults/$folder/manifest.json"
  ( cd "$tpl"
    grep -q "\"$folder\"" src/vaults/index.ts || yarn -s vault:register "$folder" >/dev/null
    yarn -s vault:check "$folder" >/dev/null
    if [[ -n "$vault" ]]; then yarn -s vault:e2e "$folder" --vault "$vault" >/dev/null; else yarn -s vault:e2e "$folder" >/dev/null; fi
    rm -f "dist/$folder.zip"
    yarn -s vault:package "$folder" >/dev/null
    yarn -s vault:verify-package "dist/$folder.zip" >/dev/null )
  cp "$tpl/dist/$folder.zip" "$out/$zip"
}

# build_launcher <manifest> <output zip>: the three source files in a directory of their own, as Flap packages them.
build_launcher() {
  local manifest="$1" zip="$2" src artifact
  artifact="$(node -p "require('$manifest').artifactId")"
  src="$work/$artifact"
  mkdir -p "$src"
  cp "$root"/flap/launcher-ui/{Component.tsx,i18n.json} "$src/"
  cp "$manifest" "$src/manifest.json"
  rm -f "$tpl/dist/$artifact-launcher.zip"
  ( cd "$tpl" && yarn -s launcher:package "$src" >/dev/null )
  cp "$tpl/dist/$artifact-launcher.zip" "$out/$zip"
}

mkdir -p "$out"
build_vault covenant-vault "$root/flap/vault-ui/manifest.json" "$prod_vault" covenant-vault-ui.zip
build_vault covenant-vault-demo "$root/flap/demo/vault-ui.manifest.json" "$demo_vault" covenant-vault-ui-demo.zip
build_launcher "$root/flap/launcher-ui/manifest.json" covenant-launcher-ui.zip
build_launcher "$root/flap/demo/launcher-ui.manifest.json" covenant-launcher-ui-demo.zip

( cd "$out" && shasum -a 256 covenant-launcher-ui.zip covenant-vault-ui.zip covenant-launcher-ui-demo.zip \
    covenant-vault-ui-demo.zip > SHA256SUMS && cat SHA256SUMS )
echo "template $(git -C "$tpl" rev-parse HEAD) ($(node -p "require('$tpl/package.json').version"))"
