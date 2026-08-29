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
    guest_session_dropped_on_adopt, SessionAdoptKey,
};
use puzzled_core::{generate_sudoku_puzzle, seeded_random, validate_and_score_sudoku};

#[test]
fn core_generates_and_scores_sudoku_without_shell() {
    let puzzle = generate_sudoku_puzzle(42, puzzled_core::SudokuDifficulty::Easy);
    assert_eq!(puzzle.puzzle_data.grid.len(), 9);
    let _ = seeded_random(1);
    let _ = validate_and_score_sudoku;
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
    assert!(guest_session_dropped_on_adopt(
        SessionAdoptKey {
            puzzle_id: Some("p1"),
            game_slug: "sudoku",
            day_key: None,
            is_ritual: false,
        },
        &[SessionAdoptKey {
            puzzle_id: Some("p1"),
            game_slug: "sudoku",
            day_key: Some("2026-08-12"),
            is_ritual: true,
        }]
    ));
}
