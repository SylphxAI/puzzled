//! The public announcement read against a real database: only rows that are on,
//! inside their window and aimed at everyone come back. Needs
//! `PUZZLED_TEST_DATABASE_URL` like the other database tests.

use chrono::{Duration, NaiveDateTime, Utc};
use sqlx::PgPool;

use crate::capabilities::admin::adapters::admin_db::{
    create_announcement, list_announcements, update_announcement,
};
use crate::capabilities::announcements::list_active;
use crate::test_support::fresh_database;

async fn insert(
    pool: &PgPool,
    title: &str,
    active: bool,
    all: bool,
    premium: bool,
    starts: Option<NaiveDateTime>,
    ends: Option<NaiveDateTime>,
) {
    sqlx::query(
        "INSERT INTO announcements \
         (title, content, is_active, target_all_users, target_premium_only, starts_at, ends_at) \
         VALUES ($1, 'body', $2, $3, $4, $5, $6)",
    )
    .bind(title)
    .bind(active)
    .bind(all)
    .bind(premium)
    .bind(starts)
    .bind(ends)
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn only_active_in_window_public_rows_are_returned() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let now = Utc::now().naive_utc();
    let hour = Duration::hours(1);
    insert(&pool, "open-ended", true, true, false, None, None).await;
    insert(
        &pool,
        "in-window",
        true,
        true,
        false,
        Some(now - hour),
        Some(now + hour),
    )
    .await;
    insert(&pool, "inactive", false, true, false, None, None).await;
    insert(&pool, "not-yet", true, true, false, Some(now + hour), None).await;
    insert(&pool, "ended", true, true, false, None, Some(now - hour)).await;
    insert(&pool, "premium", true, true, true, None, None).await;
    insert(&pool, "subset", true, false, false, None, None).await;

    let mut titles: Vec<String> = list_active(&pool, now)
        .await
        .unwrap()
        .into_iter()
        .map(|a| a.title)
        .collect();
    titles.sort();
    assert_eq!(titles, ["in-window", "open-ended"]);

    // The window is half-open: it is live at its start, over at its end.
    let later = now + hour + Duration::minutes(1);
    let titles: Vec<String> = list_active(&pool, later)
        .await
        .unwrap()
        .into_iter()
        .map(|a| a.title)
        .collect();
    assert!(titles.contains(&"not-yet".to_string()));
    assert!(!titles.contains(&"in-window".to_string()));
}

#[tokio::test]
async fn nothing_is_returned_when_the_table_is_empty() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    assert!(list_active(&pool, Utc::now().naive_utc())
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn admin_writes_the_window_and_the_public_read_follows_it() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let now = Utc::now().naive_utc();
    let admin = uuid::Uuid::now_v7().to_string();
    let row = create_announcement(
        &pool,
        "Hello",
        "Copy comes from the row",
        "info",
        true,
        false,
        Some(now - Duration::hours(1)),
        Some(now + Duration::hours(1)),
        &admin,
    )
    .await
    .unwrap();
    assert_eq!(row["dismissible"], false);
    assert!(!row["endsAt"].as_str().unwrap().is_empty());
    let active = list_active(&pool, now).await.unwrap();
    assert_eq!(active.len(), 1);
    assert!(!active[0].dismissible);

    // Clearing the end keeps the row open-ended; omitting leaves it alone.
    let id = row["id"].as_str().unwrap();
    let updated = update_announcement(&pool, id, None, None, None, None, None, None, Some(None))
        .await
        .unwrap();
    assert_eq!(updated["endsAt"], "");
    assert!(!updated["startsAt"].as_str().unwrap().is_empty());
    assert_eq!(list_announcements(&pool).await.unwrap().len(), 1);
}
