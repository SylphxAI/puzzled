//! Earned streak freezes against a real database: a freeze is earned on every
//! seventh played day (once, even when two requests race), a held freeze covers
//! a missed day so the run survives, the player can turn that off, at most two
//! are held, and a guest's freezes follow the guest onto the account. Needs
//! `PUZZLED_TEST_DATABASE_URL` like the other database tests; CI sets it and
//! `PUZZLED_REQUIRE_DB_TESTS=1`.

use chrono::NaiveDate;
use puzzled_core::gamification::personal_streak::compute_personal_streak;
use sqlx::PgPool;
use uuid::Uuid;

use crate::capabilities::gamification::adapters::freezes_db::{
    adopt_guest_freezes, load_freeze_row, settle_player_freezes,
};
use crate::capabilities::gamification::adapters::streak_sessions_db::load_accepted_ritual_days;
use crate::capabilities::preferences::adapters::account_deletion::delete_account_data;
use crate::capabilities::puzzle_play::adapters::game_sessions_db::persist_validated_session;
use crate::test_support::fresh_database;

fn day(d: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(2026, 9, d).unwrap()
}

/// One accepted finish on each of the given September days.
async fn play(pool: &PgPool, user: &Uuid, days: impl IntoIterator<Item = u32>) {
    for d in days {
        persist_validated_session(
            pool,
            &user.to_string(),
            "sudoku",
            None,
            "daily",
            "won",
            Some(70),
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
}

/// Settle as the app does on a read and return the streak it would show.
async fn read(
    pool: &PgPool,
    user: &Uuid,
    today: u32,
) -> (
    puzzled_core::gamification::personal_streak::PersonalStreak,
    i32,
    Vec<NaiveDate>,
) {
    let uid = user.to_string();
    let played = load_accepted_ritual_days(pool, &uid).await.unwrap();
    let (row, frozen) = settle_player_freezes(pool, &uid, day(today), &played)
        .await
        .unwrap();
    (
        compute_personal_streak(day(today), &played, &frozen),
        row.available,
        frozen,
    )
}

async fn count(pool: &PgPool, table: &str, user: &Uuid) -> i64 {
    sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
        "SELECT count(*) FROM {table} WHERE user_id = $1"
    )))
    .bind(user)
    .fetch_one(pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn the_seventh_played_day_earns_one_freeze_once() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    play(&pool, &user, 20..=25).await;
    let (streak, held, _) = read(&pool, &user, 25).await;
    assert_eq!(
        (streak.current_streak, held),
        (6, 0),
        "six days earn nothing"
    );
    assert_eq!(streak.days_until_next_freeze, 1);

    play(&pool, &user, [26]).await;
    let (streak, held, _) = read(&pool, &user, 26).await;
    assert_eq!((streak.current_streak, held), (7, 1));
    assert_eq!(streak.days_until_next_freeze, 7);

    // Reading again earns nothing more.
    for _ in 0..3 {
        assert_eq!(read(&pool, &user, 26).await.1, 1);
    }
    let uid = user.to_string();
    assert_eq!(load_freeze_row(&pool, &uid).await.unwrap().available, 1);
    assert_eq!(count(&pool, "streak_freeze_awards", &user).await, 1);
}

#[tokio::test]
async fn two_requests_at_once_earn_the_milestone_once() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    play(&pool, &user, 20..=26).await;
    let uid = user.to_string();
    let played = load_accepted_ritual_days(&pool, &uid).await.unwrap();
    let (a, b) = tokio::join!(
        settle_player_freezes(&pool, &uid, day(26), &played),
        settle_player_freezes(&pool, &uid, day(26), &played),
    );
    a.unwrap();
    b.unwrap();
    assert_eq!(load_freeze_row(&pool, &uid).await.unwrap().available, 1);
    assert_eq!(count(&pool, "streak_freeze_awards", &user).await, 1);
}

#[tokio::test]
async fn a_held_freeze_covers_a_missed_day_and_the_run_survives() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    play(&pool, &user, 20..=26).await;
    read(&pool, &user, 26).await; // earns the freeze

    // The 27th is missed; on the 28th the freeze covers it.
    let (streak, held, frozen) = read(&pool, &user, 28).await;
    assert_eq!(frozen, vec![day(27)]);
    assert_eq!(held, 0);
    assert_eq!(streak.current_streak, 7, "the covered day is not counted");
    assert!(streak.freeze_used_yesterday);
    assert!(!streak.has_played_today);
    let row = load_freeze_row(&pool, &user.to_string()).await.unwrap();
    assert_eq!((row.available, row.used), (0, 1));

    // Playing the 28th continues the run across the covered day.
    play(&pool, &user, [28]).await;
    let (streak, held, _) = read(&pool, &user, 28).await;
    assert_eq!((streak.current_streak, held), (8, 0));
    // Reading again covers nothing twice.
    assert_eq!(count(&pool, "streak_freeze_uses", &user).await, 1);
}

#[tokio::test]
async fn without_a_freeze_or_with_auto_off_the_run_breaks() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    // No freeze held: a missed day breaks a short run.
    let short = Uuid::now_v7();
    play(&pool, &short, 24..=25).await;
    let (streak, held, frozen) = read(&pool, &short, 27).await;
    assert_eq!((streak.current_streak, held, frozen.len()), (0, 0, 0));

    // A freeze is held but the player turned covering off: the freeze stays.
    let opted_out = Uuid::now_v7();
    play(&pool, &opted_out, 20..=26).await;
    sqlx::query(
        "INSERT INTO user_freeze_data (user_id, freezes_available, auto_freeze_enabled) \
         VALUES ($1, 1, false)",
    )
    .bind(opted_out)
    .execute(&pool)
    .await
    .unwrap();
    let (streak, held, frozen) = read(&pool, &opted_out, 28).await;
    assert_eq!(streak.current_streak, 0);
    assert_eq!(held, 2, "the earned freeze is kept on top of the held one");
    assert!(frozen.is_empty());
}

#[tokio::test]
async fn at_most_two_freezes_are_held() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    sqlx::query("INSERT INTO user_freeze_data (user_id, freezes_available) VALUES ($1, 2)")
        .bind(user)
        .execute(&pool)
        .await
        .unwrap();
    play(&pool, &user, 20..=26).await;
    let (_, held, _) = read(&pool, &user, 26).await;
    assert_eq!(held, 2, "the cap holds");
    // The milestone is recorded, so spending one later does not re-grant it.
    assert_eq!(count(&pool, "streak_freeze_awards", &user).await, 1);
    let granted: bool =
        sqlx::query_scalar("SELECT granted FROM streak_freeze_awards WHERE user_id = $1")
            .bind(user)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(!granted);
}

#[tokio::test]
async fn a_guests_freezes_follow_them_onto_the_account_and_erasure_removes_them() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let guest = Uuid::now_v7();
    let account = Uuid::now_v7();
    play(&pool, &guest, 20..=26).await;
    read(&pool, &guest, 26).await;
    assert_eq!(count(&pool, "streak_freeze_awards", &guest).await, 1);

    adopt_guest_freezes(&pool, account, guest).await.unwrap();
    assert_eq!(count(&pool, "streak_freeze_awards", &guest).await, 0);
    assert_eq!(count(&pool, "streak_freeze_awards", &account).await, 1);
    let row = load_freeze_row(&pool, &account.to_string()).await.unwrap();
    assert_eq!(row.available, 1);

    delete_account_data(&pool, &account.to_string())
        .await
        .unwrap();
    assert_eq!(count(&pool, "streak_freeze_awards", &account).await, 0);
    assert_eq!(count(&pool, "streak_freeze_uses", &account).await, 0);
    assert_eq!(
        load_freeze_row(&pool, &account.to_string())
            .await
            .unwrap()
            .available,
        0
    );
}
