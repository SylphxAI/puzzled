#!/usr/bin/env bash
# True TS-oracle vs Rust differential for puzzled game slices (ADR-168 / rej-010).
# Fail-closed: no SKIP-as-pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SLICE="${1:-all}"
if [[ "${1:-}" == "--slice" ]]; then
  SLICE="${2:-all}"
fi

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

command -v bun >/dev/null 2>&1 || fail "bun required for TS oracle"
command -v cargo >/dev/null 2>&1 || fail "cargo required for Rust differential"

echo "=== puzzled differential $(date -u +%Y-%m-%dT%H:%M:%SZ) slice=${SLICE} ==="

echo "--- TS oracle re-exec vs golden fixtures ---"
bun run "$ROOT/scripts/differential/puzzled-oracle.ts" \
  || fail "TS oracle diverged from golden fixtures"
pass "TS oracle matches golden corpus"

echo "--- Rust golden parity (puzzled-core) ---"
case "$SLICE" in
  puzzle-grid|puzzle-grid-generation|all)
    cargo test -p puzzled-core --test puzzle_grid_parity -- --nocapture \
      || fail "puzzled-core puzzle_grid_parity"
    pass "puzzle_grid_parity"
    ;;
esac

case "$SLICE" in
  puzzle-solution|puzzle-solution-submit|all)
    cargo test -p puzzled-core --test puzzle_solution_parity -- --nocapture \
      || fail "puzzled-core puzzle_solution_parity"
    pass "puzzle_solution_parity"
    ;;
esac

case "$SLICE" in
  puzzle-grid|puzzle-grid-generation|all)
    echo "--- Rust HTTP grid parity (puzzled-server) ---"
    cargo test -p puzzled-server --test puzzle_grid_http_parity -- --nocapture \
      || fail "puzzle_grid_http_parity"
    pass "puzzle_grid_http_parity"
    ;;
esac

case "$SLICE" in
  leaderboard-read|all)
    echo "--- leaderboard stub contract ---"
    cargo test -p puzzled-server --test leaderboard_stub -- --nocapture \
      || fail "leaderboard_stub"
    pass "leaderboard_stub (contract; DB differential requires DATABASE_URL)"
    ;;
esac

# Dockerfile must ship puzzled-core (root cause of prod grid/submit 404 after S2).
echo "--- Dockerfile workspace members ---"
grep -q 'crates/puzzled-core' crates/puzzled-server/Dockerfile \
  || fail "Dockerfile missing puzzled-core COPY (prod build cannot link S2 handlers)"
pass "Dockerfile includes puzzled-core"

echo "=== puzzled differential GREEN slice=${SLICE} ==="
