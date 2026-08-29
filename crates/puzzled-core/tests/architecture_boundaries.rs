//! Writer postconditions for ADR-169: functional core decides without shell I/O.

use puzzled_core::billing_access::policy::is_free_plan;
use puzzled_core::gamification::personal_streak::parse_day_key;
use puzzled_core::identity_policy::guest_day_id::normalize_guest_user_id;
use puzzled_core::jobs_policy::backoff::backoff_base_ms;
use puzzled_core::leaderboard::enrich::ANONYMOUS_DISPLAY_NAME;
use puzzled_core::presentation_policy::reduced_motion::prefers_reduced_from_matches;
use puzzled_core::privacy::pii_scrub::looks_like_email;
use puzzled_core::product_policy::error_codes::ERROR_CODES;
use puzzled_core::puzzle_play::ritual_completion::{
    qualifies_as_ritual, submit_must_guard_already_played, RitualQualifyInput,
};
use puzzled_core::{
    generate_sudoku_puzzle, seeded_random, validate_and_score_sudoku, GameSubmission,
    ScoringResult, SubmissionStatus,
};

#[test]
fn core_generates_and_scores_sudoku_without_shell() {
    let puzzle = generate_sudoku_puzzle(42, puzzled_core::SudokuDifficulty::Easy);
    assert_eq!(puzzle.puzzle_data.grid.len(), 9);
    let _ = seeded_random(1);
    let final_grid: Vec<Vec<u64>> = puzzle
        .solution
        .grid
        .iter()
        .map(|row| row.iter().copied().map(u64::from).collect())
        .collect();
    let result = validate_and_score_sudoku(
        &puzzle.solution,
        &GameSubmission {
            status: SubmissionStatus::Won,
            attempts: 1,
            time_spent_ms: 0,
            data: Some(serde_json::json!({ "finalGrid": final_grid, "mistakes": 0 })),
        },
    );
    assert_eq!(result, ScoringResult::valid(SubmissionStatus::Won, 1000));
}

#[test]
fn capability_domains_decide_on_fixture_facts() {
    assert!(normalize_guest_user_id("a1b2c3d4-e5f6-7890-abcd-ef1234567890").is_some());
    assert_eq!(ANONYMOUS_DISPLAY_NAME, "Anonymous");
    assert!(is_free_plan(None));
    assert_eq!(backoff_base_ms(0), 60_000);
    assert!(looks_like_email("player@example.com"));
    assert!(ERROR_CODES.contains(&"UNAUTHORIZED"));
    assert!(!prefers_reduced_from_matches(false));
    assert!(parse_day_key("2026-08-12").is_ok());
    assert!(qualifies_as_ritual(RitualQualifyInput {
        game_module_id: "sudoku",
        mode: "daily",
        status: "won",
        is_dry_run: false,
    }));
    assert!(submit_must_guard_already_played(true, None, true));
    assert!(!submit_must_guard_already_played(true, None, false));
}
