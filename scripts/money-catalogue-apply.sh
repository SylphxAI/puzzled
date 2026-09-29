#!/usr/bin/env bash
# Applies config/commercial/catalogue.json to one Sylphx Money environment.
# Run only by .github/workflows/money-catalogue.yml, which is the only writer of
# the catalogue: no manual catalogue writes.
#
# Needs: ACCESS_NAME (the tenant-manifest entry), SYLPHX_ORG, SYLPHX_PROJECT,
# SYLPHX_ENV, and the runner's OIDC request variables (id-token: write).
set -euo pipefail

missing=""
for name in ACCESS_NAME SYLPHX_ORG SYLPHX_PROJECT SYLPHX_ENV ACTIONS_ID_TOKEN_REQUEST_URL ACTIONS_ID_TOKEN_REQUEST_TOKEN; do
  if [ -z "${!name:-}" ]; then missing="$missing $name"; fi
done
if [ -n "$missing" ]; then
  echo "::error::missing:$missing. SYLPHX_ORG and SYLPHX_PROJECT are repository variables; the OIDC variables need permissions: id-token: write."
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

# 2. Trade it for a short-lived key. The key is masked and never printed.
body=$(jq -cn --arg name "$ACCESS_NAME" --arg token "$jwt" '{name: $name, token: $token}')
code=$(curl -sS -o "$work/access.out" -w '%{http_code}' -X POST \
  "https://api.sylphx.com/v1/access/github/token" \
  -H 'Content-Type: application/json' --data "$body")
if [ "$code" -ge 300 ]; then
  echo "::error::Access refused the token exchange for ${ACCESS_NAME} (${code})"; exit 1
fi
key=$(jq -r '.key // .token // .secret // .access_token // empty' "$work/access.out")
rm -f "$work/access.out"
if [ -z "$key" ]; then
  echo "::error::Access answered without a key"; exit 1
fi
echo "::add-mask::${key}"

# 3. Convert the declaration into Money's spec, patch, and sync.
bun scripts/money-catalogue-spec.ts config/commercial/catalogue.json > "$work/catalog.json"
base="https://api.sylphx.com/v1/orgs/${SYLPHX_ORG}/projects/${SYLPHX_PROJECT}/envs/${SYLPHX_ENV}/catalogs/default"

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
echo "catalogue applied to ${SYLPHX_ENV}"
