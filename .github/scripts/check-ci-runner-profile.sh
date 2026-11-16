#!/usr/bin/env bash
# Fails when a workflow job selects a billed or unguarded GitHub-hosted runner
# (owner standards/dx.md, SylphxAI/.github docs/runner-spend.md). Allowed:
# - Self-hosted control and Linux pools: sylphx-linux-control,
#   sylphx-linux-{standard,large,xlarge,2xlarge}(-merge), or the canonical
#   merge_group selector `${{ github.event_name == 'merge_group' && 'sylphx-linux-<size>-merge' || 'sylphx-linux-<size>' }}`.
# - Affirmatively visibility-guarded standard ubuntu-latest:
#   `${{ github.event.repository.visibility == 'public' && 'ubuntu-latest' || <self-hosted-fallback> }}`.
# - Self-hosted macOS label arrays holding self-hosted, sylphx and macos.
# Anything else, including bare ubuntu-latest/ubuntu-NN.NN, billed runners,
# and arbitrary expressions, fails closed.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
errors=0
found=0

while IFS= read -r -d '' workflow; do
  while IFS=$'\t' read -r line value; do
    found=1
    value="${value%%#*}"
    value="$(printf '%s' "$value" | sed -E "s/^[[:space:]]+//; s/[[:space:]]+\$//; s/^[\"']//; s/[\"']\$//")"
    if [[ "$value" =~ ^sylphx-linux-(control|(standard|large|xlarge|2xlarge)(-merge)?)$ ]]; then
      continue
    fi
    if [[ "$value" =~ ^\$\{\{[[:space:]]*github\.event_name[[:space:]]*==[[:space:]]*\'merge_group\'[[:space:]]*\&\&[[:space:]]*\'sylphx-linux-(standard|large|xlarge|2xlarge)-merge\'[[:space:]]*\|\|[[:space:]]*\'sylphx-linux-(standard|large|xlarge|2xlarge)\'[[:space:]]*\}\}$ ]]; then
      continue
    fi
    if [[ "$value" =~ ^\$\{\{[[:space:]]*github\.event\.repository\.visibility[[:space:]]*==[[:space:]]*\'public\'[[:space:]]*\&\&[[:space:]]*\'ubuntu-latest\'[[:space:]]*\|\|[[:space:]]*(\'sylphx-linux-(control|(standard|large|xlarge|2xlarge)(-merge)?)\'|\([[:space:]]*github\.event_name[[:space:]]*==[[:space:]]*\'merge_group\'[[:space:]]*\&\&[[:space:]]*\'sylphx-linux-(standard|large|xlarge|2xlarge)-merge\'[[:space:]]*\|\|[[:space:]]*\'sylphx-linux-(standard|large|xlarge|2xlarge)\'[[:space:]]*\))[[:space:]]*\}\}$ ]]; then
      continue
    fi
    if [[ "$value" =~ ^\[.*\]$ && "$value" != *'${{'* && ",${value//[][ ]/}," == *,self-hosted,* \
      && ",${value//[][ ]/}," == *,sylphx,* && ",${value//[][ ]/}," == *,macos,* ]]; then
      continue
    fi
    printf '%s:%s: runner %q is not an allowed self-hosted or visibility-guarded runner\n' \
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
echo "OK: every workflow job selects an allowed self-hosted or visibility-guarded runner"
