#!/usr/bin/env bash
# Applies config/commercial/catalogue.json to one Sylphx Money environment.
# Run only by .github/workflows/money-catalogue.yml, which is the only writer of
# the catalogue: no manual catalogue writes.
#
# Needs: ACCESS_NAME (the tenant-manifest entry) and the runner's OIDC request
# variables (id-token: write). The org, project and env are the key's own: they
# come from the exchange answer, never from configuration.
set -euo pipefail

missing=""
for name in ACCESS_NAME ACTIONS_ID_TOKEN_REQUEST_URL ACTIONS_ID_TOKEN_REQUEST_TOKEN; do
  if [ -z "${!name:-}" ]; then missing="$missing $name"; fi
done
if [ -n "$missing" ]; then
  echo "::error::missing:$missing. The OIDC variables need permissions: id-token: write."
  exit 1
fi

work="${RUNNER_TEMP:-/tmp}"

# 1. A GitHub OIDC token for the Sylphx Access audience.
jwt=$(curl -sS --fail-with-body \
  -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
  "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=sylphx-access" | jq -r '.value')
if [ -z "$jwt" ] || [ "$jwt" = "null" ]; then
  echo "::error::GitHub did not return an OIDC token"; exit 1
fi
echo "::add-mask::${jwt}"

# 2. Trade it for a short-lived key. The answer is
#    {"api_key": "sylphx_sk_...", "key": {ApiKey resource}, "expires_at": ..., "active_after_ms": ...}.
body=$(jq -cn --arg name "$ACCESS_NAME" --arg token "$jwt" '{name: $name, token: $token}')
code=$(curl -sS -o "$work/access.out" -w '%{http_code}' -X POST \
  "https://api.sylphx.com/v1/access/github/token" \
  -H 'Content-Type: application/json' --data "$body")
if [ "$code" -ge 300 ]; then
  echo "::error::Access refused the token exchange for ${ACCESS_NAME} (${code})"; exit 1
fi
key=$(jq -r '.api_key // empty' "$work/access.out")
if [ -z "$key" ]; then
  echo "::error::Access answered without an api_key"; exit 1
fi
echo "::add-mask::${key}"
# The environment is the key's own: its name is orgs/{o}/projects/{p}/envs/{e}/api_keys/{k}.
resource=$(jq -r '.key.name // empty' "$work/access.out" | sed 's#/api_keys/.*$##')
active_after_ms=$(jq -r '.active_after_ms // 0' "$work/access.out")
rm -f "$work/access.out"
case "$resource" in
  orgs/*/projects/*/envs/*) ;;
  *) echo "::error::the key is not scoped to an environment"; exit 1 ;;
esac
# A new key is usable only after this delay.
if [ "$active_after_ms" -gt 0 ]; then
  sleep "$(awk -v ms="$active_after_ms" 'BEGIN { printf "%.3f", ms / 1000 }')"
fi

# 3. Convert the declaration into Money's spec, patch, and sync.
bun scripts/money-catalogue-spec.ts config/commercial/catalogue.json > "$work/catalog.json"
base="https://api.sylphx.com/v1/${resource}/catalogs/default"

code=$(curl -sS -o "$work/patch.out" -w '%{http_code}' -X PATCH "${base}?allow_missing=true" \
  -H "Authorization: Bearer ${key}" -H 'Content-Type: application/json' \
  --data @"$work/catalog.json")
if [ "$code" -ge 300 ]; then
  echo "::error::PATCH catalogs/default answered ${code}"; cat "$work/patch.out"; exit 1
fi

code=$(curl -sS -o "$work/sync.out" -w '%{http_code}' -X POST "${base}:sync" \
  -H "Authorization: Bearer ${key}" -H 'Content-Type: application/json' --data '{}')
if [ "$code" -ge 300 ]; then
  echo "::error::POST catalogs/default:sync answered ${code}"; cat "$work/sync.out"; exit 1
fi
echo "catalogue applied to ${resource##*/}"
