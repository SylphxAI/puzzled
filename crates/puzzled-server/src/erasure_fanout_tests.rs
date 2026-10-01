//! The platform's user-deletion fan-out end to end, against a fake delivery
//! (signed like Auth signs) and a fake evidence endpoint. Needs
//! `PUZZLED_TEST_DATABASE_URL`, like the other database tests.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::body::{to_bytes, Body};
use axum::http::{Method, Request, StatusCode};
use axum::{Json, Router};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use crate::billing_flow_tests::{complete_checkout, fresh_database, spawn_fake, Fake};
use crate::capabilities::billing::adapters::stripe::Stripe;
use crate::capabilities::billing::service as billing;
use crate::capabilities::identity_access::adapters::erasure_delivery::{
    sign_delivery, ErasureTransport,
};
use crate::{router, AppState};

const PATH: &str = "/webhooks/sylphx/erasure";
const PROJECT: &str = "org_own";
const PROJECT_ID: &str = "proj_01kmp4wyhhfgxsyrjvh8e0tkkf";
const SECRET_KEY: &str = "sk_test_erasure";
const WEBHOOK_SECRET: &str = "test-erasure-signing-fixture";

/// A fake evidence endpoint: records each post, fails the first `fail` calls.
#[derive(Clone, Default)]
struct FakeAuth {
    seen: Arc<Mutex<Vec<Value>>>,
    fail: Arc<Mutex<usize>>,
}

async fn spawn_auth(fake: FakeAuth) -> String {
    let app = Router::new().route(
        "/v1/privacy-requests/{id}/evidence",
        axum::routing::post(
            move |axum::extract::Path(id): axum::extract::Path<String>,
                  headers: axum::http::HeaderMap,
                  Json(body): Json<Value>| {
                let fake = fake.clone();
                async move {
                    fake.seen.lock().unwrap().push(json!({
                        "id": id,
                        "authorization": headers
                            .get("authorization")
                            .and_then(|v| v.to_str().ok())
                            .unwrap_or_default(),
                        "body": body,
                    }));
                    let mut fail = fake.fail.lock().unwrap();
                    if *fail > 0 {
                        *fail -= 1;
                        return StatusCode::SERVICE_UNAVAILABLE;
                    }
                    StatusCode::OK
                }
            },
        ),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

fn state(pool: &PgPool, auth_url: &str) -> AppState {
    AppState::new(Some(pool.clone())).with_erasure_fanout(Some(ErasureTransport::new(
        auth_url.to_string(),
        PROJECT_ID.to_string(),
        None,
        SECRET_KEY.to_string(),
        WEBHOOK_SECRET.to_string(),
    )))
}

fn event(user_id: &str, request_id: &str, project_id: &str) -> Vec<u8> {
    json!({
        "type": "auth.user.deletion_requested",
        "data": {
            "org_id": PROJECT, "project_id": project_id, "env_id": "env_prod",
            "user_id": user_id, "request_id": request_id,
            "respond_by": "2026-11-01T00:00:00Z",
        }
    })
    .to_string()
    .into_bytes()
}

async fn deliver(app: &Router, body: Vec<u8>, secret: &str) -> (StatusCode, Value) {
    let now = chrono::Utc::now().timestamp();
    let signature = sign_delivery(secret, "msg_1", now, &body);
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(PATH)
                .header("webhook-id", "msg_1")
                .header("webhook-timestamp", now.to_string())
                .header("webhook-signature", signature)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

async fn count(pool: &PgPool, table: &str, column: &str, player: Uuid) -> i64 {
    sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
        r#"SELECT count(*) FROM "{table}" WHERE "{column}" = $1"#
    )))
    .bind(player)
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn seed(pool: &PgPool, player: Uuid, subject: &str) {
    sqlx::query(r#"INSERT INTO "notification_preferences" ("user_id") VALUES ($1)"#)
        .bind(player)
        .execute(pool)
        .await
        .unwrap();
    sqlx::query(r#"INSERT INTO "auth_subjects" ("subject", "user_id") VALUES ($1, $2)"#)
        .bind(subject)
        .bind(player)
        .execute(pool)
        .await
        .unwrap();
    sqlx::query(
        r#"INSERT INTO "billing_ledger"
           ("source_id", "kind", "user_id", "stripe_customer_id", "currency", "amount_minor", "occurred_at")
           VALUES ($1, 'invoice', $2, 'cus_x', 'gbp', 499, now())"#,
    )
    .bind(format!("src_{player}"))
    .bind(player)
    .execute(pool)
    .await
    .unwrap();
}

fn store<'a>(evidence: &'a Value, name: &str) -> &'a Value {
    evidence["stores"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["store"] == name)
        .unwrap_or_else(|| panic!("no store {name} in {evidence}"))
}

#[tokio::test]
async fn a_verified_delivery_erases_the_player_and_posts_evidence() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake = FakeAuth::default();
    let base = spawn_auth(fake.clone()).await;
    let app = router(state(&pool, &base));
    let player = Uuid::now_v7();
    seed(&pool, player, "usr_01kmp4wyhhfgxsyrjvh8e0tkkf").await;

    let (status, body) = deliver(
        &app,
        event("usr_01kmp4wyhhfgxsyrjvh8e0tkkf", "pr_1", PROJECT_ID),
        WEBHOOK_SECRET,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["replay"], false);

    assert_eq!(
        count(&pool, "notification_preferences", "user_id", player).await,
        0
    );
    assert_eq!(count(&pool, "auth_subjects", "user_id", player).await, 0);
    // The money row stays, with the player id cleared.
    assert_eq!(count(&pool, "billing_ledger", "user_id", player).await, 0);
    let kept: i64 =
        sqlx::query_scalar(r#"SELECT count(*) FROM "billing_ledger" WHERE "source_id" = $1"#)
            .bind(format!("src_{player}"))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(kept, 1);

    let seen = fake.seen.lock().unwrap();
    assert_eq!(seen.len(), 1);
    assert_eq!(seen[0]["id"], "pr_1");
    assert_eq!(seen[0]["authorization"], format!("Bearer {SECRET_KEY}"));
    let evidence = &seen[0]["body"];
    assert_eq!(evidence["handler"], "puzzled/api");
    assert!(evidence["completed_at"].as_str().unwrap().ends_with('Z'));
    assert_eq!(store(evidence, "notification_preferences")["deleted"], 1);
    assert_eq!(store(evidence, "auth_subjects")["deleted"], 1);
    let ledger = store(evidence, "billing_ledger");
    assert_eq!(ledger["deleted"], 0);
    assert_eq!(ledger["anonymised"], 1);
    assert_eq!(ledger["kept"][0]["count"], 1);
    assert!(ledger["kept"][0]["reason"]
        .as_str()
        .unwrap()
        .contains("tax"));
}

#[tokio::test]
async fn a_replay_is_a_no_op_that_answers_the_same_evidence() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake = FakeAuth::default();
    let base = spawn_auth(fake.clone()).await;
    let app = router(state(&pool, &base));
    let player = Uuid::now_v7();
    seed(&pool, player, "usr_01kmp4wyhhfgxsyrjvh8e0tkkf").await;
    let user = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";

    let (_, first) = deliver(&app, event(user, "pr_2", PROJECT_ID), WEBHOOK_SECRET).await;
    // The same subject signs in again and gets rows; a replay must not touch them.
    let again = player;
    sqlx::query(r#"INSERT INTO "notification_preferences" ("user_id") VALUES ($1)"#)
        .bind(again)
        .execute(&pool)
        .await
        .unwrap();
    let (status, second) = deliver(&app, event(user, "pr_2", PROJECT_ID), WEBHOOK_SECRET).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(second["replay"], true);
    assert_eq!(first["evidence"], second["evidence"]);
    assert_eq!(
        count(&pool, "notification_preferences", "user_id", again).await,
        1
    );
    // Auth had the evidence after the first delivery: no second post.
    assert_eq!(fake.seen.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn evidence_that_fails_is_retried_and_a_redelivery_reposts_it() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake = FakeAuth::default();
    let base = spawn_auth(fake.clone()).await;
    let app = router(state(&pool, &base));
    let player = Uuid::now_v7();
    seed(&pool, player, "usr_01kmp4wyhhfgxsyrjvh8e0tkkf").await;
    let user = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";

    // Every attempt fails (no pause budget): not acknowledged, but erased once.
    *fake.fail.lock().unwrap() = 100;
    let response = crate::bootstrap::erasure_fanout_for_tests(
        &state(&pool, &base),
        &event(user, "pr_3", PROJECT_ID),
        &[Duration::from_millis(1), Duration::from_millis(1)],
    )
    .await;
    assert_eq!(response, StatusCode::BAD_GATEWAY);
    assert_eq!(fake.seen.lock().unwrap().len(), 3);
    assert_eq!(
        count(&pool, "notification_preferences", "user_id", player).await,
        0
    );

    // Auth re-announces; the endpoint recovers; the stored evidence is posted.
    *fake.fail.lock().unwrap() = 0;
    let (status, body) = deliver(&app, event(user, "pr_3", PROJECT_ID), WEBHOOK_SECRET).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["replay"], true);
    let seen = fake.seen.lock().unwrap();
    assert_eq!(seen.len(), 4);
    assert_eq!(seen[3]["body"]["stores"], seen[0]["body"]["stores"]);
    assert_eq!(
        seen[3]["body"]["completed_at"],
        seen[0]["body"]["completed_at"]
    );
}

#[tokio::test]
async fn unverified_and_foreign_deliveries_touch_nothing() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake = FakeAuth::default();
    let base = spawn_auth(fake.clone()).await;
    let app = router(state(&pool, &base));
    let player = Uuid::now_v7();
    seed(&pool, player, "usr_01kmp4wyhhfgxsyrjvh8e0tkkf").await;
    let user = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";

    // Signed with the wrong secret.
    let (status, _) = deliver(
        &app,
        event(user, "pr_4", PROJECT_ID),
        "test-erasure-wrong-signing-fixture",
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // No signature at all.
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(PATH)
                .body(Body::from(event(user, "pr_4", PROJECT_ID)))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // Correctly signed, but for another project.
    let (status, _) = deliver(
        &app,
        event(user, "pr_5", "proj_01kmp4wyhhfgxsyrjvh8e0tkkg"),
        WEBHOOK_SECRET,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    assert_eq!(
        count(&pool, "notification_preferences", "user_id", player).await,
        1
    );
    let recorded: i64 = sqlx::query_scalar(r#"SELECT count(*) FROM "erasure_requests""#)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(recorded, 0);
    assert!(fake.seen.lock().unwrap().is_empty());
}

#[tokio::test]
async fn an_unknown_user_gets_evidence_with_zero_rows() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake = FakeAuth::default();
    let base = spawn_auth(fake.clone()).await;
    let app = router(state(&pool, &base));

    let (status, body) = deliver(
        &app,
        event("usr_01kmp4wyhhfgxsyrjvh8e0tkkg", "pr_6", PROJECT_ID),
        WEBHOOK_SECRET,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let seen = fake.seen.lock().unwrap();
    assert_eq!(seen.len(), 1);
    for s in seen[0]["body"]["stores"].as_array().unwrap() {
        assert_eq!(s["deleted"], 0, "{s}");
        assert_eq!(s["anonymised"], 0, "{s}");
        assert_eq!(s["kept"], json!([]), "{s}");
    }
}

#[tokio::test]
async fn an_old_form_id_with_no_subject_row_reaches_its_player() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let fake = FakeAuth::default();
    let base = spawn_auth(fake.clone()).await;
    let app = router(state(&pool, &base));
    let player = Uuid::now_v7();
    sqlx::query(r#"INSERT INTO "notification_preferences" ("user_id") VALUES ($1)"#)
        .bind(player)
        .execute(&pool)
        .await
        .unwrap();
    let (status, _) = deliver(
        &app,
        event(&format!("principal-{player}"), "pr_7", PROJECT_ID),
        WEBHOOK_SECRET,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        count(&pool, "notification_preferences", "user_id", player).await,
        0
    );
}

fn stripe_at(base: String) -> Stripe {
    Stripe::new(
        "sk_test_flow".into(),
        "test-billing-signing-fixture".into(),
        base,
        "https://puzzled.test".into(),
    )
}

/// A player with a renewing subscription, synced into the database.
async fn subscribe(pool: &PgPool, fake: &Fake, stripe: &Stripe, player: Uuid) -> String {
    let sub = complete_checkout(
        fake,
        "cus_1",
        &player.to_string(),
        "puzzled_individual_monthly",
        499,
    );
    billing::sync_subscription(pool, stripe, &sub)
        .await
        .unwrap();
    sub
}

async fn subscription_owner(pool: &PgPool, sub: &str) -> Option<Uuid> {
    sqlx::query_scalar(
        r#"SELECT "user_id" FROM "billing_subscriptions" WHERE "stripe_subscription_id" = $1"#,
    )
    .bind(sub)
    .fetch_one(pool)
    .await
    .unwrap()
}

#[tokio::test]
async fn a_renewing_subscription_is_cancelled_before_the_erasure() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let auth = FakeAuth::default();
    let auth_base = spawn_auth(auth.clone()).await;
    let fake: Fake = Arc::default();
    let stripe = stripe_at(spawn_fake(fake.clone()).await);
    let player = Uuid::now_v7();
    let user = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, user).await;
    let sub = subscribe(&pool, &fake, &stripe, player).await;
    let app = router(state(&pool, &auth_base).with_stripe(Some(stripe)));

    let (status, body) = deliver(&app, event(user, "pr_8", PROJECT_ID), WEBHOOK_SECRET).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    // Inside the refund window: refunded, ended at Stripe, and no charge left.
    assert_eq!(fake.lock().unwrap().refunds.len(), 1);
    assert_eq!(
        fake.lock().unwrap().subscriptions[&sub]["status"],
        "canceled"
    );
    // The row stays for tax, unlinked from the player.
    assert_eq!(subscription_owner(&pool, &sub).await, None);
    assert_eq!(
        count(&pool, "notification_preferences", "user_id", player).await,
        0
    );
    let seen = auth.seen.lock().unwrap();
    let subs = store(&seen[0]["body"], "billing_subscriptions");
    let reasons: Vec<&str> = subs["kept"]
        .as_array()
        .unwrap()
        .iter()
        .map(|k| k["reason"].as_str().unwrap())
        .collect();
    assert!(
        reasons.contains(&"subscription cancelled at erasure"),
        "{subs}"
    );
    let cancelled = subs["kept"]
        .as_array()
        .unwrap()
        .iter()
        .find(|k| k["reason"] == "subscription cancelled at erasure")
        .unwrap();
    assert_eq!(cancelled["count"], 1);
}

#[tokio::test]
async fn a_failed_cancel_erases_nothing_and_answers_502() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let auth = FakeAuth::default();
    let auth_base = spawn_auth(auth.clone()).await;
    let fake: Fake = Arc::default();
    let stripe = stripe_at(spawn_fake(fake.clone()).await);
    let player = Uuid::now_v7();
    let user = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, user).await;
    let sub = subscribe(&pool, &fake, &stripe, player).await;

    // Stripe becomes unreachable (nothing listens on port 1), and the other
    // failing case: billing not configured at all.
    for unreachable in [Some(stripe_at("http://127.0.0.1:1".into())), None] {
        let app = router(state(&pool, &auth_base).with_stripe(unreachable));
        let (status, _) = deliver(&app, event(user, "pr_9", PROJECT_ID), WEBHOOK_SECRET).await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert_eq!(
            count(&pool, "notification_preferences", "user_id", player).await,
            1
        );
        assert_eq!(subscription_owner(&pool, &sub).await, Some(player));
        assert_eq!(fake.lock().unwrap().subscriptions[&sub]["status"], "active");
    }
    let recorded: i64 = sqlx::query_scalar(r#"SELECT count(*) FROM "erasure_requests""#)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(recorded, 0);
    assert!(auth.seen.lock().unwrap().is_empty());
}
