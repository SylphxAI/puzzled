//! The first-party funnel counter against a real database: the four events are
//! stored anonymously and read back with plain SQL. Needs
//! `PUZZLED_TEST_DATABASE_URL` like the other database tests.

use crate::capabilities::funnel::{insert, record_signup, validate_browser, Incoming};
use crate::test_support::fresh_database;

fn row(json: &str) -> crate::capabilities::funnel::Row {
    validate_browser(&serde_json::from_str::<Incoming>(json).unwrap()).unwrap()
}

#[tokio::test]
async fn landing_game_start_signup_and_web_vitals_are_counted() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    insert(&pool, &row(r#"{"event":"landing","path":"/"}"#))
        .await
        .unwrap();
    insert(
        &pool,
        &row(r#"{"event":"game_start","game_slug":"word-guess"}"#),
    )
    .await
    .unwrap();
    record_signup(&pool).await.unwrap();
    insert(
        &pool,
        &row(r#"{"event":"web_vitals","metric":"LCP","value":1800,"rating":"good","path":"/"}"#),
    )
    .await
    .unwrap();
    let counts: Vec<(String, i64)> =
        sqlx::query_as(r#"SELECT "event", count(*) FROM "funnel_events" GROUP BY 1 ORDER BY 1"#)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(
        counts,
        vec![
            ("game_start".to_owned(), 1),
            ("landing".to_owned(), 1),
            ("signup".to_owned(), 1),
            ("web_vitals".to_owned(), 1),
        ]
    );
}
