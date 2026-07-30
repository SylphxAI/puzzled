#!/usr/bin/env bash
# Fail closed: customer product repos must not vendor Platform SDK/wire.
# Allow: crates.io / npm registry deps (sylphx-sdk, @sylphx/sdk, sylphx-wire-mock as dev-dep).
# Forbid: path/file/link copies of sylphx-wire, sylphx-sdk*, platform/rust-sdk.
set -euo pipefail
ROOT="${1:-.}"
cd "$ROOT"
fail=0

# 1) Vendored crate trees
while IFS= read -r -d '' d; do
  rel="${d#./}"
  # allow nothing for these names in product repos
  echo "FAIL: vendored Platform crate tree: $rel" >&2
  fail=1
done < <(find . -type d \( \
    -name 'sylphx-wire' -o -name 'sylphx-sdk' -o -name 'sylphx-sdk-core' \
    -o -name 'sylphx-wire-mock' -o -name 'sylphx-sdk-management' \
  \) \
  ! -path './.git/*' ! -path './target/*' ! -path './node_modules/*' \
  ! -path '*/node_modules/*' ! -path '*/target/*' \
  -print0 2>/dev/null || true)

# 2) Cargo path deps into vendor/third_party/platform rust-sdk
if command -v rg >/dev/null 2>&1; then
  if hits=$(rg -n --glob '**/Cargo.toml' \
      'path\s*=\s*"[^"]*(vendor|third_party)[^"]*sylphx|path\s*=\s*"[^"]*rust-sdk/sylphx|path\s*=\s*"[^"]*platform/rust-sdk' \
      . 2>/dev/null | rg -v '^\./?target/|node_modules' || true); then
    if [ -n "${hits}" ]; then
      echo "FAIL: Cargo path dependency on Platform SDK/wire:" >&2
      echo "$hits" >&2
      fail=1
    fi
  fi
  # 3) npm file:/link: to platform packages
  if hits=$(rg -n --glob '**/package.json' \
      '"@sylphx/[^"]+"\s*:\s*"(file:|link:)[^"]*(platform|sylphx-sdk|rust-sdk|vendor|third_party)' \
      . 2>/dev/null | rg -v node_modules || true); then
    if [ -n "${hits}" ]; then
      echo "FAIL: npm file:/link: dependency on Platform package source:" >&2
      echo "$hits" >&2
      fail=1
    fi
  fi
  # 4) Copied platform protos
  if hits=$(find . -type f -path '*/sylphx/platform/v1/*.proto' \
      ! -path './.git/*' ! -path './target/*' ! -path '*/node_modules/*' 2>/dev/null | head -20); then
    if [ -n "${hits}" ]; then
      echo "FAIL: copied Platform protos (contract SSOT is Platform, not customer):" >&2
      echo "$hits" >&2
      fail=1
    fi
  fi
fi

if [ "$fail" -ne 0 ]; then
  echo "Platform boundary violation. Customer apps must use published sylphx-sdk / @sylphx/sdk only." >&2
  exit 1
fi
echo "OK: platform boundary clean ($ROOT)"
