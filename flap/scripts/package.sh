#!/usr/bin/env bash
# Build the two flap.sh packages with Flap's own tooling and copy them to flap/packages/ with their SHA-256.
#
#   FLAP_TEMPLATE_DIR=/path/to/flap-vault-component-template flap/scripts/package.sh [--vault 0x…]
#
# FLAP_TEMPLATE_DIR is a clean checkout of github.com/flap-sh/flap-vault-component-template on `main` (Flap's
# packaging refuses a checkout that is not exactly origin/main), with `yarn install --frozen-lockfile` and
# `yarn playwright install chromium` done. --vault passes a real vault for the token in the Vault UI manifest to
# vault:e2e, so the screenshots show live reads (the template's preview cannot always resolve the vault by itself).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
tpl="${FLAP_TEMPLATE_DIR:?set FLAP_TEMPLATE_DIR to a flap-vault-component-template checkout on main}"
vault_args=()
if [[ "${1:-}" == "--vault" ]]; then vault_args=(--vault "${2:?--vault needs an address}"); fi
folder=covenant-vault
out="$root/flap/packages"

node "$root/flap/scripts/sync-manifests.mjs" --check

# Vault UI: the four core files go to src/vaults/<folder>, registered for local preview.
mkdir -p "$tpl/src/vaults/$folder"
cp "$root"/flap/vault-ui/{Component.tsx,VaultABI.ts,i18n.json,manifest.json} "$tpl/src/vaults/$folder/"
( cd "$tpl"
  grep -q "\"$folder\"" src/vaults/index.ts || yarn -s vault:register "$folder" >/dev/null
  yarn -s vault:check "$folder" >/dev/null
  yarn -s vault:e2e "$folder" "${vault_args[@]}" >/dev/null
  rm -f "dist/$folder.zip"
  yarn -s vault:package "$folder" >/dev/null
  yarn -s vault:verify-package "dist/$folder.zip" >/dev/null )

# Launcher UI: Flap's checker and packager take the source directory as is.
artifact="$(node -p "require('$root/flap/launcher-ui/manifest.json').artifactId")"
rm -f "$tpl/dist/$artifact-launcher.zip"
( cd "$tpl" && yarn -s launcher:package "$root/flap/launcher-ui" >/dev/null )

mkdir -p "$out"
cp "$tpl/dist/$folder.zip" "$out/covenant-vault-ui.zip"
cp "$tpl/dist/$artifact-launcher.zip" "$out/covenant-launcher-ui.zip"
( cd "$out" && shasum -a 256 covenant-launcher-ui.zip covenant-vault-ui.zip > SHA256SUMS && cat SHA256SUMS )
echo "template $(git -C "$tpl" rev-parse HEAD) ($(node -p "require('$tpl/package.json').version"))"
