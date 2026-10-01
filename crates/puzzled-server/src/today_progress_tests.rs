//! GetTodayProgress read against a real database: one query reports the
//! caller's finishes for the given product day only, per game, one row per
//! (user, game, day). Needs `PUZZLED_TEST_DATABASE_URL` like the other
//! database tests; CI sets it and `PUZZLED_REQUIRE_DB_TESTS=1`.

use chrono::NaiveDate;
use uuid::Uuid;

use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    load_today_progress, persist_validated_session,
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
