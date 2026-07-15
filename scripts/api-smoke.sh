#!/usr/bin/env bash
# Production smoke for puzzled-server Rust api service (ADR-168 S0–S2).
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
readyz_for_lb="$(curl -fsS "$BASE_URL/readyz")"
python3 -c "
import json,sys
lb=json.loads(sys.argv[1]); rz=json.loads(sys.argv[2])
assert isinstance(lb.get('entries'), list), lb
assert 'stub' in lb, lb
# When postgres is ready (readyz.stub=false), leaderboard must not be S0 stub.
if rz.get('stub') is False:
    assert lb.get('stub') is False, f'leaderboard still stub while readyz non-stub: {lb}'
" "$leaderboard" "$readyz_for_lb" || fail "/api/leaderboard: $leaderboard (readyz=$readyz_for_lb)"
pass "/api/leaderboard envelope (entries + stub authority)"

stats_lb="$(curl -fsS "$BASE_URL/api/v1/stats/leaderboard?gameSlug=sudoku&type=score&period=all&limit=5")"
echo "$stats_lb" | python3 -c "import json,sys; d=json.load(sys.stdin); assert isinstance(d, list)" \
  || fail "/api/v1/stats/leaderboard: $stats_lb"
pass "/api/v1/stats/leaderboard array contract"

readyz="$(curl -fsS "$BASE_URL/readyz")"
echo "$readyz" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('slice') in ('S0','S1','S2')" \
  || fail "/readyz slice: $readyz"
pass "/readyz slice marker"

# Prod sole-process probes that previously 404'd on incomplete dens.
auth_session="$(curl -fsS "$BASE_URL/api/v1/auth/session")"
echo "$auth_session" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('authenticated') is False or d.get('session'); assert d.get('slice')=='auth-sessions'" \
  || fail "/api/v1/auth/session: $auth_session"
pass "/api/v1/auth/session"

games_index="$(curl -fsS "$BASE_URL/api/v1/games")"
echo "$games_index" | python3 -c "import json,sys; d=json.load(sys.stdin); assert isinstance(d.get('games'), list) and len(d['games'])>=1; assert d.get('slice')=='api-v1-hono-monolith'" \
  || fail "/api/v1/games: $games_index"
pass "/api/v1/games domain index"

daily="$(curl -fsS "$BASE_URL/api/v1/games/daily-status?gameSlug=sudoku")"
echo "$daily" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'canPlay' in d or d.get('mode')=='daily'" \
  || fail "/api/v1/games/daily-status: $daily"
pass "/api/v1/games/daily-status"

# S2 game paths — must not 404 once Dockerfile ships puzzled-core.
grid_code="$(curl -sS -o /tmp/puzzled-grid.json -w '%{http_code}' \
  "$BASE_URL/api/v1/puzzles/grid?gameSlug=sudoku&seed=42&difficulty=easy" || true)"
if [[ "$grid_code" == "200" ]]; then
  python3 -c "import json; d=json.load(open('/tmp/puzzled-grid.json')); assert d.get('gameSlug')=='sudoku'; assert d.get('seed')==42; assert 'puzzleData' in d; assert 'solution' in d" \
    || fail "/api/v1/puzzles/grid body"
  pass "/api/v1/puzzles/grid"
else
  echo "WARN: /api/v1/puzzles/grid HTTP $grid_code (deploy lag or pre-S2 image)" >&2
  # Soft-warn only when env allows; default fail-closed for local/CI smoke.
  if [[ "${PUZZLED_SMOKE_ALLOW_S2_MISSING:-0}" != "1" ]]; then
    fail "/api/v1/puzzles/grid expected 200 got $grid_code"
  fi
fi

# Submit with solution grid from grid response when available.
if [[ "$grid_code" == "200" ]]; then
  submit_body="$(python3 - <<'PY'
import json
d=json.load(open('/tmp/puzzled-grid.json'))
sol=d['solution']['grid']
print(json.dumps({
  "gameSlug": "sudoku",
  "seed": 42,
  "difficulty": "easy",
  "submission": {
    "status": "won",
    "attempts": 1,
    "timeSpentMs": 5000,
    "data": {"finalGrid": sol, "mistakes": 0}
  }
}))
PY
)"
  submit_code="$(curl -sS -o /tmp/puzzled-submit.json -w '%{http_code}' \
    -X POST "$BASE_URL/api/v1/puzzles/submit" \
    -H 'content-type: application/json' \
    -d "$submit_body" || true)"
  [[ "$submit_code" == "200" ]] || fail "/api/v1/puzzles/submit HTTP $submit_code"
  python3 -c "import json; d=json.load(open('/tmp/puzzled-submit.json')); assert d.get('valid') is True; assert d.get('status')=='won'; assert isinstance(d.get('score'), int)" \
    || fail "/api/v1/puzzles/submit body"
  pass "/api/v1/puzzles/submit"
fi

echo "=== puzzled-api prod smoke passed ==="
