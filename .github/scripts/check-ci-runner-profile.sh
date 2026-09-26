#!/usr/bin/env bash
# Fails when any workflow job selects a runner we do not own (owner
# standards/dx.md: every CI job runs on our own runners, public or private).
# Allowed: sylphx-linux-{standard,large,xlarge,2xlarge}, and the macOS class
# as a label array holding self-hosted, sylphx and macos. Anything else,
# including GitHub-hosted labels (ubuntu-*, windows-*, macos-*), expressions
# and multi-line selections, fails closed.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
errors=0
found=0

while IFS= read -r -d '' workflow; do
  while IFS=$'\t' read -r line value; do
    found=1
    value="${value%%#*}"
    value="$(printf '%s' "$value" | sed -E "s/^[[:space:]]+//; s/[[:space:]]+\$//; s/^[\"']//; s/[\"']\$//")"
    if [[ "$value" =~ ^sylphx-linux-(standard|large|xlarge|2xlarge)$ ]]; then
      continue
    fi
    if [[ "$value" =~ ^\[.*\]$ && "$value" != *'${{'* && ",${value//[][ ]/}," == *,self-hosted,* \
      && ",${value//[][ ]/}," == *,sylphx,* && ",${value//[][ ]/}," == *,macos,* ]]; then
      continue
    fi
    printf '%s:%s: runner %q is not one of ours; use sylphx-linux-standard (or the macOS class)\n' \
      "${workflow#"$root"/}" "$line" "$value" >&2
    errors=1
  done < <(grep -nE '^[[:space:]]*runs-on:' "$workflow" \
    | sed -E 's/^([0-9]+):[[:space:]]*runs-on:[[:space:]]*/\1\t/' || true)
done < <(find "$root/.github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \) -print0 | sort -z)

if [[ "$found" -eq 0 ]]; then
  echo "no workflow runner selections found" >&2
  exit 1
fi
[[ "$errors" -eq 0 ]] || exit 1
echo "OK: every workflow job runs on our own runners"
