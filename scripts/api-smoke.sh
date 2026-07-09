#!/usr/bin/env bash
# Production smoke for puzzled-server Rust api service (ADR-168).
set -euo pipefail

BASE_URL="${BASE_URL:-https://idle-tie-elxzm6.sylphx.app}"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

echo "=== puzzled-api prod smoke $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "base: $BASE_URL"

healthz="$(curl -fsS "$BASE_URL/healthz")"
[[ "$healthz" == *"ok"* ]] || fail "/healthz: $healthz"
pass "/healthz"

readyz="$(curl -fsS "$BASE_URL/readyz")"
echo "$readyz" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('status')=='ok'" \
  || fail "/readyz: $readyz"
pass "/readyz"

leaderboard="$(curl -fsS "$BASE_URL/api/leaderboard")"
echo "$leaderboard" | python3 -c "import json,sys; d=json.load(sys.stdin); assert isinstance(d.get('entries'), list); assert d.get('stub') is True" \
  || fail "/api/leaderboard: $leaderboard"
pass "/api/leaderboard stub envelope"

stats_lb="$(curl -fsS "$BASE_URL/api/v1/stats/leaderboard?gameSlug=sudoku&type=score&period=all&limit=5")"
echo "$stats_lb" | python3 -c "import json,sys; d=json.load(sys.stdin); assert isinstance(d, list)" \
  || fail "/api/v1/stats/leaderboard: $stats_lb"
pass "/api/v1/stats/leaderboard array contract"

readyz="$(curl -fsS "$BASE_URL/readyz")"
echo "$readyz" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('slice') in ('S0','S1','S2')" \
  || fail "/readyz slice: $readyz"
pass "/readyz slice marker"

echo "=== puzzled-api prod smoke passed ==="