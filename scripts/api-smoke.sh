#!/usr/bin/env bash
# Production smoke for puzzled-server Rust api service (ADR-168).
set -euo pipefail

BASE_URL="${BASE_URL:-https://idle-tie-elxzm6.sylphx.app}"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

echo "=== puzzled-api prod smoke $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "slice: S2 authority_rust (api path_prefixes /healthz + /readyz + /api/v1/stats/leaderboard + /api/v1/puzzles/grid + /api/v1/puzzles/submit)"
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

grid="$(curl -fsS "$BASE_URL/api/v1/puzzles/grid?gameSlug=sudoku&seed=42&difficulty=medium")"
echo "$grid" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('gameSlug')=='sudoku'; assert d.get('seed')==42; assert d.get('slice')=='S2-puzzle-grid'; assert len(d.get('solution',{}).get('grid',[]))==9" \
  || fail "/api/v1/puzzles/grid: $grid"
pass "/api/v1/puzzles/grid sudoku contract"

submit_body="$(python3 -c "
import json, urllib.request
grid = json.load(urllib.request.urlopen('${BASE_URL}/api/v1/puzzles/grid?gameSlug=sudoku&seed=42&difficulty=medium'))
body = {
  'gameSlug': 'sudoku',
  'solution': grid['solution'],
  'puzzleData': grid['puzzleData'],
  'submission': {
    'status': 'won',
    'attempts': 1,
    'timeSpentMs': 0,
    'data': {'finalGrid': grid['solution']['grid'], 'mistakes': 0}
  }
}
print(json.dumps(body))
")"
submit="$(curl -fsS -X POST "$BASE_URL/api/v1/puzzles/submit" -H 'Content-Type: application/json' -d "$submit_body")"
echo "$submit" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('valid') is True; assert d.get('status')=='won'; assert d.get('slice')=='S2-puzzle-solution-submit'; assert d.get('score',0)>=100" \
  || fail "/api/v1/puzzles/submit: $submit"
pass "/api/v1/puzzles/submit sudoku scoring contract"

echo "=== puzzled-api prod smoke passed ==="