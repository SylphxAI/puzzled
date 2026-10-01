//! Tryit conversions against a real database and a fake Tryit: only a Tryit
//! landing is queued, an account is reported once, a 503 is retried by the
//! sweep, and an account without a Tryit ref sends nothing. Needs
//! `PUZZLED_TEST_DATABASE_URL` like the other database tests; CI sets it and
//! `PUZZLED_REQUIRE_DB_TESTS=1`.

use std::sync::{Arc, Mutex};

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use axum::{Json, Router};
use puzzled_core::attribution::Attribution;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::capabilities::preferences::adapters::attribution_db::record_attribution;
use crate::capabilities::tryit_conversions::{
    enqueue, enqueue_purchase, report_now, sweep, Event, TryitReporter,
};
use crate::test_support::fresh_database;

type Calls = Arc<Mutex<Vec<Value>>>;

/// A fake Tryit answering with the scripted statuses in order (the last one repeats).
async fn fake_tryit(statuses: Vec<u16>) -> (TryitReporter, Calls) {
    let calls: Calls = Arc::default();
    let script = Arc::new(Mutex::new(statuses));
    async fn handle(
        State((calls, script)): State<(Calls, Arc<Mutex<Vec<u16>>>)>,
        Json(body): Json<Value>,
    ) -> StatusCode {
        calls.lock().unwrap().push(body);
        let mut script = script.lock().unwrap();
        let next = if script.len() > 1 {
            script.remove(0)
        } else {
            script[0]
        };
        StatusCode::from_u16(next).unwrap()
    }
    let app = Router::new()
        .route("/api/attribution/conversions", post(handle))
        .with_state((calls.clone(), script));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let reporter = TryitReporter::new(&format!("http://{addr}"), "test-key").unwrap();
    (reporter, calls)
}

fn tags(cookie: &str) -> Attribution {
    Attribution::from_cookie(cookie).expect("tags")
}

async fn signed_up(pool: &PgPool, cookie: &str) -> String {
    let user = Uuid::now_v7().to_string();
    let tags = tags(cookie);
    record_attribution(pool, &user, &tags).await.unwrap();
    enqueue(pool, &user, &tags, Event::Signup).await.unwrap();
    user
}

async fn state_of(pool: &PgPool, user: &str, event: &str) -> (i32, bool, bool) {
    sqlx::query_as(
        r#"SELECT "attempts", "reported_at" IS NOT NULL, "gave_up_at" IS NOT NULL
           FROM "tryit_conversions" WHERE "user_id" = $1 AND "event" = $2"#,
    )
    .bind(Uuid::parse_str(user).unwrap())
    .bind(event)
    .fetch_one(pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn a_tryit_signup_is_reported_once() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let (reporter, calls) = fake_tryit(vec![201]).await;
    let user = signed_up(&pool, "s=tryit&r=res-42").await;
    // Queued once, however often the sign-up is recorded again.
    assert!(
        !enqueue(&pool, &user, &tags("s=tryit&r=res-42"), Event::Signup)
            .await
            .unwrap()
    );
    report_now(&pool, Some(&reporter), &user).await;
    report_now(&pool, Some(&reporter), &user).await;
    assert_eq!(sweep(&pool, &reporter).await.unwrap(), 0);
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0]["ref"], "res-42");
    assert_eq!(calls[0]["event"], "signup");
    assert_eq!(calls[0]["product"], "puzzled");
    assert_eq!(state_of(&pool, &user, "signup").await, (1, true, false));
}

#[tokio::test]
async fn a_503_stays_queued_and_the_sweep_retries_it() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let (reporter, calls) = fake_tryit(vec![503, 201]).await;
    let user = signed_up(&pool, "s=tryit&r=res-503").await;
    report_now(&pool, Some(&reporter), &user).await;
    assert_eq!(state_of(&pool, &user, "signup").await, (1, false, false));
    // Just tried: the sweep leaves it for a few minutes.
    assert_eq!(sweep(&pool, &reporter).await.unwrap(), 0);
    sqlx::query(r#"UPDATE "tryit_conversions" SET "last_attempt_at" = now() - interval '1 hour'"#)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(sweep(&pool, &reporter).await.unwrap(), 1);
    assert_eq!(state_of(&pool, &user, "signup").await, (2, true, false));
    assert_eq!(calls.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn a_refusal_is_given_up_and_an_old_row_is_never_sent() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let (reporter, calls) = fake_tryit(vec![403]).await;
    let refused = signed_up(&pool, "s=tryit&r=res-403").await;
    report_now(&pool, Some(&reporter), &refused).await;
    assert_eq!(state_of(&pool, &refused, "signup").await, (1, false, true));
    let old = signed_up(&pool, "s=tryit&r=res-old").await;
    sqlx::query(r#"UPDATE "tryit_conversions" SET "occurred_at" = now() - interval '40 days' WHERE "user_id" = $1"#)
        .bind(Uuid::parse_str(&old).unwrap())
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(sweep(&pool, &reporter).await.unwrap(), 0);
    assert_eq!(state_of(&pool, &old, "signup").await, (0, false, true));
    assert_eq!(calls.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn nothing_is_queued_or_sent_without_a_tryit_ref() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let (reporter, calls) = fake_tryit(vec![201]).await;
    // A share link (ref, no Tryit source), another source, and an untagged
    // account: no row, no call.
    let share = signed_up(&pool, "r=0198a3f2-7c1d-7e2a-9d5b-3c4e5f6a7b8c&p=%2Fdaily").await;
    let other = signed_up(&pool, "s=newsletter&r=abc").await;
    let no_ref = signed_up(&pool, "s=tryit").await;
    let untagged = Uuid::now_v7().to_string();
    for user in [&share, &other, &no_ref, &untagged] {
        report_now(&pool, Some(&reporter), user).await;
        assert!(!enqueue_purchase(&pool, user).await.unwrap());
    }
    assert_eq!(sweep(&pool, &reporter).await.unwrap(), 0);
    let rows: i64 = sqlx::query_scalar(r#"SELECT count(*) FROM "tryit_conversions""#)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(rows, 0);
    assert!(calls.lock().unwrap().is_empty());
}

#[tokio::test]
async fn a_purchase_is_queued_once_for_a_tryit_account() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let (reporter, calls) = fake_tryit(vec![201]).await;
    let user = signed_up(&pool, "s=tryit&r=res-buy").await;
    assert!(enqueue_purchase(&pool, &user).await.unwrap());
    assert!(!enqueue_purchase(&pool, &user).await.unwrap());
    report_now(&pool, Some(&reporter), &user).await;
    let events: Vec<String> = calls
        .lock()
        .unwrap()
        .iter()
        .map(|c| c["event"].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(events, ["signup", "purchase"]);
}
