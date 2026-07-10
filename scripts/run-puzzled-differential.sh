#!/usr/bin/env bash
# Puzzled differential parity — TS oracle vs Rust HTTP + core SSOT.
# Slices: puzzle-grid, puzzle-solution-submit, leaderboard-read.
# Fail-closed: requires bun (no SKIP-as-pass). See rej-010 / DECISION-001.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="${SCRATCH_DIR:-/tmp/puzzled-differential}"
mkdir -p "$SCRATCH"
LOG="$SCRATCH/differential.log"
ARTIFACT="$SCRATCH/verification.json"
ORACLE_JSON="$SCRATCH/oracle.json"
SLICE_FILTER="all"
: >"$LOG"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slice)
      SLICE_FILTER="${2:-}"
      shift 2
      ;;
    *)
      echo "::error::unknown argument: $1" | tee -a "$LOG"
      exit 1
      ;;
  esac
done

case "$SLICE_FILTER" in
  all|puzzle-grid|puzzle-solution-submit|leaderboard-read) ;;
  *)
    echo "::error::invalid --slice value: $SLICE_FILTER" | tee -a "$LOG"
    exit 1
    ;;
esac

cd "$REPO_ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "::error::bun required for puzzled differential parity — no SKIP-as-pass" | tee -a "$LOG"
  exit 1
fi

echo "=== puzzled differential parity $(date -Iseconds) slice=$SLICE_FILTER ===" | tee -a "$LOG"

echo "--- check:proto-buf gate ---" | tee -a "$LOG"
bun run "$REPO_ROOT/scripts/check-proto-buf.ts" 2>&1 | tee -a "$LOG"

echo "--- TS oracle (puzzle-grid + puzzle-solution-submit + leaderboard) ---" | tee -a "$LOG"
bun run "$REPO_ROOT/scripts/differential/puzzled-oracle.ts" >"$ORACLE_JSON" 2>>"$LOG"

run_rust_slice_test() {
  local label="$1"
  local test_name="$2"
  echo "--- Rust bounded slice: $label ---" | tee -a "$LOG"
  PUZZLED_ORACLE_JSON="$ORACLE_JSON" \
    cargo test -p puzzled-server --test puzzled_differential "$test_name" -- --nocapture 2>&1 | tee -a "$LOG"
}

case "$SLICE_FILTER" in
  puzzle-grid)
    run_rust_slice_test "puzzle-grid" puzzle_grid_generation_differential_matches_ts_oracle
    ;;
  puzzle-solution-submit)
    run_rust_slice_test "puzzle-solution-submit" puzzle_solution_submit_differential_matches_ts_oracle
    ;;
  leaderboard-read)
    run_rust_slice_test "leaderboard-read" leaderboard_read_differential_matches_ts_oracle
    ;;
  all)
    run_rust_slice_test "puzzle-grid" puzzle_grid_generation_differential_matches_ts_oracle
    run_rust_slice_test "puzzle-solution-submit" puzzle_solution_submit_differential_matches_ts_oracle
    run_rust_slice_test "leaderboard-read" leaderboard_read_differential_matches_ts_oracle
    echo "--- Rust differential test (full corpus) ---" | tee -a "$LOG"
    PUZZLED_ORACLE_JSON="$ORACLE_JSON" \
      cargo test -p puzzled-server --test puzzled_differential puzzled_differential_matches_ts_oracle -- --nocapture 2>&1 | tee -a "$LOG"
    ;;
esac

CANDIDATE_SHA="${CANDIDATE_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}"
BASELINE_TS_SHA="$(git -C "$REPO_ROOT" log -1 --format=%H -- \
  apps/puzzled/src/games/sudoku/generator.ts \
  apps/puzzled/src/games/registry.ts \
  apps/puzzled/src/server/api/routes/stats.ts \
  2>/dev/null || echo unknown)"
RUST_SHA="$CANDIDATE_SHA"
BEHAVIOR_SPEC_HASH="$(sha256sum "$REPO_ROOT/scripts/differential/fixtures/puzzled-corpus.json" 2>/dev/null | awk '{print $1}' || echo missing)"
FIXTURE_CORPUS_HASH="$(jq -r '.fixtureCorpusHash' "$ORACLE_JSON")"
CASE_COUNT="$(jq '.cases | length' "$ORACLE_JSON")"
GRID_CASES="$(jq '[.cases[] | select(.slice == "puzzle-grid")] | length' "$ORACLE_JSON")"
SOLUTION_CASES="$(jq '[.cases[] | select(.slice == "puzzle-solution-submit")] | length' "$ORACLE_JSON")"
LEADERBOARD_CASES="$(jq '[.cases[] | select(.slice == "leaderboard-read")] | length' "$ORACLE_JSON")"
HTTP_CASES="$(jq '[.cases[] | select(.kind == "http")] | length' "$ORACLE_JSON")"

jq -n \
  --arg verifiedAt "$(date -Iseconds)" \
  --arg candidateSha "$CANDIDATE_SHA" \
  --arg baselineTsSha "$BASELINE_TS_SHA" \
  --arg rustCandidateSha "$RUST_SHA" \
  --arg behaviorSpecHash "$BEHAVIOR_SPEC_HASH" \
  --arg fixtureCorpusHash "$FIXTURE_CORPUS_HASH" \
  --arg sliceFilter "$SLICE_FILTER" \
  --argjson caseCount "$CASE_COUNT" \
  --argjson gridCases "$GRID_CASES" \
  --argjson solutionCases "$SOLUTION_CASES" \
  --argjson leaderboardCases "$LEADERBOARD_CASES" \
  --argjson httpCases "$HTTP_CASES" \
  '{
    schemaVersion: 2,
    slice: (if $sliceFilter == "all" then "puzzle-grid|puzzle-solution-submit|leaderboard-read" else $sliceFilter end),
    sliceFilter: $sliceFilter,
    status: "differential_green",
    verifiedAt: $verifiedAt,
    lastComparedMainSha: $candidateSha,
    mergeGroupSha: $candidateSha,
    baselineTsSha: $baselineTsSha,
    rustCandidateSha: $rustCandidateSha,
    behaviorSpecHash: $behaviorSpecHash,
    fixtureCorpusHash: $fixtureCorpusHash,
    caseCount: $caseCount,
    gridCases: $gridCases,
    solutionCases: $solutionCases,
    leaderboardCases: $leaderboardCases,
    httpCases: $httpCases,
    harness: "scripts/run-puzzled-differential.sh",
    differentialTest: "crates/puzzled-server/tests/puzzled_differential.rs#puzzle_grid_generation_differential_matches_ts_oracle; puzzle_solution_submit_differential_matches_ts_oracle; leaderboard_read_differential_matches_ts_oracle; puzzled_differential_matches_ts_oracle",
    boundedSlices: {
      "puzzle-grid": "crates/puzzled-server/tests/puzzled_differential.rs#puzzle_grid_generation_differential_matches_ts_oracle",
      "puzzle-solution-submit": "crates/puzzled-server/tests/puzzled_differential.rs#puzzle_solution_submit_differential_matches_ts_oracle",
      "leaderboard-read": "crates/puzzled-server/tests/puzzled_differential.rs#leaderboard_read_differential_matches_ts_oracle"
    },
    oracle: "scripts/differential/puzzled-oracle.ts"
  }' >"$ARTIFACT"

echo "puzzled-differential: OK (cases=$CASE_COUNT grid=$GRID_CASES solution=$SOLUTION_CASES leaderboard=$LEADERBOARD_CASES http=$HTTP_CASES corpus=$FIXTURE_CORPUS_HASH)" | tee -a "$LOG"
echo "verification artifact: $ARTIFACT" | tee -a "$LOG"