//! GetTodayProgress read against a real database: one query reports the
//! caller's finishes for the given product day only, per game, one row per
//! (user, game, day). Needs `PUZZLED_TEST_DATABASE_URL` like the other
//! database tests; CI sets it and `PUZZLED_REQUIRE_DB_TESTS=1`.

use chrono::NaiveDate;
use uuid::Uuid;

use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    load_completed_session, load_today_progress, persist_validated_session,
};
use crate::test_support::fresh_database;

fn day(d: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 9, d).unwrap()
}

#[tokio::test]
async fn reports_only_this_players_finishes_for_the_requested_day() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let me = Uuid::now_v7();
    let other = Uuid::now_v7();
    for (user, game, d, score) in [
        (me, "sudoku", 10, 70),
        (me, "wordle", 9, 55),
        (other, "crowns", 10, 90),
    ] {
        persist_validated_session(
            &pool,
            &user.to_string(),
            game,
            None,
            "daily",
            "won",
            Some(score),
            3,
            61_000,
            None,
            Some(day(d)),
            Some(day(d)),
            0,
        )
        .await
        .expect("finish stored");
    }
    let slugs: Vec<String> = ["sudoku", "wordle", "crowns"].map(String::from).to_vec();
    let found = load_today_progress(&pool, &me.to_string(), &slugs, day(10))
        .await
        .unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found["sudoku"].score, Some(70));
    let empty = load_today_progress(&pool, &me.to_string(), &[], day(10))
        .await
        .unwrap();
    assert!(empty.is_empty());
}

/// One finish per (user, game, day), whatever the level: the completed read
/// never takes a level, so every level's GetDaily lookup lands on the same row
/// and must report the level that row was actually played at.
#[tokio::test]
async fn the_one_finish_reports_the_level_it_was_played_at() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let me = Uuid::now_v7().to_string();
    for (game, level) in [("sudoku", Some("medium")), ("wordle", None)] {
        persist_validated_session(
            &pool,
            &me,
            game,
            level,
            "daily",
            "won",
            Some(80),
            1,
            61_000,
            None,
            Some(day(10)),
            Some(day(10)),
            0,
        )
        .await
        .expect("finish stored");
    }
    // The easy, medium and hard reads all resolve through this date lookup.
    for _level in ["easy", "medium", "hard"] {
        let done = load_completed_session(&pool, &me, "sudoku", Some(day(10)), None)
            .await
            .unwrap()
            .expect("the day's finish is found at every level");
        assert_eq!(done.difficulty.as_deref(), Some("medium"));
    }
    let slugs: Vec<String> = ["sudoku", "wordle"].map(String::from).to_vec();
    let progress = load_today_progress(&pool, &me, &slugs, day(10))
        .await
        .unwrap();
    assert_eq!(progress["sudoku"].difficulty.as_deref(), Some("medium"));
    assert_eq!(progress["wordle"].difficulty, None);
    let wordle = load_completed_session(&pool, &me, "wordle", Some(day(10)), None)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(wordle.difficulty, None);
}
