//! The daily reminder against a real database: each player is reminded at
//! their own time in their own time zone, once per local day, never after
//! finishing today's puzzle, and a failed send is given back for the next
//! tick. Needs `PUZZLED_TEST_DATABASE_URL` like the other database tests; CI
//! sets it and `PUZZLED_REQUIRE_DB_TESTS=1`.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::billing_flow_tests::fresh_database;
use crate::capabilities::jobs::adapters::jobs_db::{
    claim_due_daily_reminders, release_daily_reminder,
};
use crate::capabilities::preferences::adapters::preferences_db::is_reminder_time;
use crate::capabilities::puzzle_play::adapters::game_sessions_db::persist_validated_session;

/// 01:00 UTC on 30 September: 09:00 in Hong Kong, 21:00 the evening before in
/// New York, and the product day (Hong Kong) is 2026-09-30.
fn now() -> DateTime<Utc> {
    "2026-09-30T01:00:00Z".parse().unwrap()
}

const PRODUCT_DAY: &str = "2026-09-30";

async fn player(pool: &PgPool, time: &str, zone: Option<&str>, reminder_on: bool) -> Uuid {
    let user = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO notification_preferences \
           (user_id, push_enabled, push_daily_reminder, daily_reminder_time, timezone) \
         VALUES ($1, true, $2, $3, $4)",
    )
    .bind(user)
    .bind(reminder_on)
    .bind(time)
    .bind(zone)
    .execute(pool)
    .await
    .unwrap();
    user
}

async fn due(pool: &PgPool, at: DateTime<Utc>) -> Vec<String> {
    claim_due_daily_reminders(pool, at, PRODUCT_DAY)
        .await
        .unwrap()
        .into_iter()
        .map(|(user, _)| user)
        .collect()
}

#[tokio::test]
async fn each_player_is_reminded_at_their_own_local_time() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let hong_kong = player(&pool, "09:00", Some("Asia/Hong_Kong"), true).await;
    let new_york = player(&pool, "09:00", Some("America/New_York"), true).await;
    let utc_early = player(&pool, "01:00", None, true).await;
    let utc_later = player(&pool, "09:00", None, true).await;
    let unknown_zone = player(&pool, "01:00", Some("Nowhere/Land"), true).await;
    let opted_out = player(&pool, "09:00", Some("Asia/Hong_Kong"), false).await;

    let sent = due(&pool, now()).await;
    let mut expected = vec![
        hong_kong.to_string(),
        utc_early.to_string(),
        unknown_zone.to_string(),
    ];
    let mut got = sent.clone();
    expected.sort();
    got.sort();
    assert_eq!(got, expected);
    for not_due in [new_york, utc_later, opted_out] {
        assert!(!sent.contains(&not_due.to_string()));
    }

    // New York's 09:00 comes eight hours later.
    let later = due(&pool, now() + Duration::hours(12)).await;
    assert_eq!(later, vec![new_york.to_string()]);
}

#[tokio::test]
async fn a_late_tick_still_sends_within_the_grace_and_not_beyond() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    // 09:00 in Hong Kong now; 90 minutes and 150 minutes after the set time.
    let ninety = player(&pool, "07:30", Some("Asia/Hong_Kong"), true).await;
    let one_fifty = player(&pool, "06:30", Some("Asia/Hong_Kong"), true).await;
    let before = player(&pool, "09:30", Some("Asia/Hong_Kong"), true).await;
    assert_eq!(due(&pool, now()).await, vec![ninety.to_string()]);
    assert!(!due(&pool, now()).await.contains(&one_fifty.to_string()));
    assert!(!due(&pool, now()).await.contains(&before.to_string()));
    // Half an hour on, 09:30 has come.
    assert_eq!(
        due(&pool, now() + Duration::minutes(30)).await,
        vec![before.to_string()]
    );
}

#[tokio::test]
async fn a_player_is_reminded_once_per_local_day() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = player(&pool, "09:00", Some("Asia/Hong_Kong"), true).await;
    assert_eq!(due(&pool, now()).await, vec![user.to_string()]);
    // Overlapping and later ticks in the same window send nothing more.
    assert!(due(&pool, now()).await.is_empty());
    assert!(due(&pool, now() + Duration::minutes(15)).await.is_empty());
    // The next local day sends again.
    assert_eq!(
        due(&pool, now() + Duration::days(1)).await,
        vec![user.to_string()]
    );
}

#[tokio::test]
async fn a_failed_send_is_released_for_the_next_tick() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = player(&pool, "09:00", Some("Asia/Hong_Kong"), true).await;
    assert_eq!(due(&pool, now()).await, vec![user.to_string()]);
    release_daily_reminder(&pool, &user.to_string())
        .await
        .unwrap();
    assert_eq!(
        due(&pool, now() + Duration::minutes(15)).await,
        vec![user.to_string()]
    );
}

#[tokio::test]
async fn nobody_is_reminded_after_finishing_todays_puzzle() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let finished = player(&pool, "09:00", Some("Asia/Hong_Kong"), true).await;
    let waiting = player(&pool, "09:00", Some("Asia/Hong_Kong"), true).await;
    let day = NaiveDate::parse_from_str(PRODUCT_DAY, "%Y-%m-%d").unwrap();
    persist_validated_session(
        &pool,
        &finished.to_string(),
        "sudoku",
        None,
        "daily",
        "won",
        Some(70),
        3,
        61_000,
        None,
        Some(day),
        Some(day),
        0,
    )
    .await
    .unwrap();
    assert_eq!(due(&pool, now()).await, vec![waiting.to_string()]);
}

#[test]
fn a_reminder_time_is_a_24_hour_clock_time() {
    for good in ["00:00", "09:00", "23:59"] {
        assert!(is_reminder_time(good), "{good}");
    }
    for bad in [
        "", "9:00", "24:00", "12:60", "12-30", "ab:cd", "09:0", "+9:00", "09:000",
    ] {
        assert!(!is_reminder_time(bad), "{bad}");
    }
}
