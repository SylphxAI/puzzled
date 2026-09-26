#!/usr/bin/env bash
# Fails when a workflow job selects a runner that could bill us (owner
# standards/dx.md). This repository is public, so GitHub's standard hosted
# runners are free here and allowed: ubuntu-latest / ubuntu-NN.NN[-arm],
# windows-latest / windows-NNNN / windows-11-arm, macos-latest / macos-NN.
# GitHub's larger and GPU runners (custom names, macos-NN-large/-xlarge) are
# billed even for public repositories and fail. Our own runners pass:
# sylphx-linux-{standard,large,xlarge,2xlarge}, and the macOS class as a label
# array holding self-hosted, sylphx and macos. Anything else, including
# expressions and multi-line selections, fails closed.
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
    if [[ "$value" =~ ^(ubuntu-(latest|[0-9]+\.[0-9]+(-arm)?)|windows-(latest|[0-9]{4}|11-arm)|macos-(latest|[0-9]+))$ ]]; then
      continue
    fi
    if [[ "$value" =~ ^\[.*\]$ && "$value" != *'${{'* && ",${value//[][ ]/}," == *,self-hosted,* \
      && ",${value//[][ ]/}," == *,sylphx,* && ",${value//[][ ]/}," == *,macos,* ]]; then
      continue
    fi
    printf '%s:%s: runner %q is neither ours nor a free standard GitHub-hosted runner\n' \
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
echo "OK: no workflow job selects a billed runner"
