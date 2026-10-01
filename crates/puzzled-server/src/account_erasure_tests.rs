//! Durable account-erasure acceptance, suppression, and ownership proofs.
//! Acceptance preserves rows and never calls Auth before Money preparation.
//! Adapter proofs keep malformed receipts distinct from authoritative absence. Needs `PUZZLED_TEST_DATABASE_URL` (a server where a
//! throwaway database can be created); CI sets it and
//! `PUZZLED_REQUIRE_DB_TESTS=1`, so a missing database fails there instead of
//! skipping.

use std::sync::{Arc, Mutex};

use axum::body::{to_bytes, Body};
use axum::http::{Method, Request, StatusCode};
use axum::{Json, Router};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use crate::capabilities::identity_access::adapters::auth_erasure::AuthErasure;
use crate::capabilities::identity_access::adapters::platform_jwt::test_key_lock;
use crate::test_support::{fresh_database, token};
use crate::{router, AppState};

const DELETE_PATH: &str = "/puzzled.v1.PreferencesService/DeleteAccountData";
const ORGANIZATION_ID: &str = "org_test";
const SECRET_KEY: &str = "sk_test_erasure";

/// A stub Auth that records every privacy request it receives.
#[derive(Clone)]
struct StubAuth {
    seen: Arc<Mutex<Vec<Value>>>,
    status: u16,
    answer: Value,
}

impl StubAuth {
    fn accepting() -> Self {
        Self {
            seen: Arc::default(),
            status: 202,
            answer: json!({"privacy_request": {"request_id": "privacy-request-1",
                                                "state": "pending", "organization_id": ORGANIZATION_ID, "request_type": "delete"}}),
        }
    }

    fn answering(status: u16, answer: Value) -> Self {
        Self {
            seen: Arc::default(),
            status,
            answer,
        }
    }

    /// The subjects Auth was asked to delete, in request order.
    fn subjects(&self) -> Vec<String> {
        self.seen
            .lock()
            .unwrap()
            .iter()
            .filter_map(|request| request["body"]["principal_id"].as_str().map(str::to_string))
            .collect()
    }
}

async fn spawn_auth(stub: StubAuth) -> String {
    let app = Router::new().route(
        "/v1/privacy-requests",
        axum::routing::post(move |headers: axum::http::HeaderMap, body: String| {
            let stub = stub.clone();
            async move {
                stub.seen.lock().unwrap().push(json!({
                    "authorization": headers
                        .get(axum::http::header::AUTHORIZATION)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or_default(),
                    "body": serde_json::from_str::<Value>(&body).unwrap_or(Value::Null),
                }));
                let mut answer = stub.answer.clone();
                if answer["privacy_request"].is_object() {
                    answer["privacy_request"]["principal_id"] =
                        serde_json::from_str::<Value>(&body).unwrap()["principal_id"].clone();
                }
                (StatusCode::from_u16(stub.status).unwrap(), Json(answer))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

/// The api as production serves it. `auth_url` None is Enable Auth unbound.
fn app(pool: &PgPool, auth_url: Option<String>) -> Router {
    let state = AppState::new(Some(pool.clone())).with_erasure(
        auth_url.map(|url| AuthErasure::new(url, ORGANIZATION_ID.into(), SECRET_KEY.into())),
    );
    router(state)
}

/// A player with notification preferences and (optionally) Auth subjects.
async fn seed(pool: &PgPool, player: Uuid, subjects: &[&str]) {
    sqlx::query(r#"INSERT INTO "notification_preferences" ("user_id") VALUES ($1)"#)
        .bind(player)
        .execute(pool)
        .await
        .unwrap();
    for subject in subjects {
        sqlx::query(r#"INSERT INTO "auth_subjects" ("subject", "user_id") VALUES ($1, $2)"#)
            .bind(*subject)
            .bind(player)
            .execute(pool)
            .await
            .unwrap();
    }
}

async fn preference_rows(pool: &PgPool, player: Uuid) -> i64 {
    sqlx::query_scalar(r#"SELECT count(*) FROM "notification_preferences" WHERE "user_id" = $1"#)
        .bind(player)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn subject_rows(pool: &PgPool, player: Uuid) -> i64 {
    sqlx::query_scalar(r#"SELECT count(*) FROM "auth_subjects" WHERE "user_id" = $1"#)
        .bind(player)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn delete_account(app: &Router, bearer: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(DELETE_PATH)
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer {bearer}"))
                .body(Body::from(json!({"confirm": "DELETE"}).to_string()))
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

fn message(body: &Value) -> String {
    body["message"].as_str().unwrap_or_default().to_string()
}

fn assert_diagnostic(body: &Value, expected_reason: &str) {
    let message = message(body);
    assert!(message.contains(&format!("reason={expected_reason} ")));
    let reference = message
        .split("request_ref=")
        .nth(1)
        .expect("request reference");
    assert_eq!(Uuid::parse_str(reference).unwrap().get_version_num(), 7);
    assert!(!message.contains(SECRET_KEY));
}

#[tokio::test]
async fn accepted_erasure_persists_owned_snapshot_without_auth_effects() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let names = ["subject-fixture".to_string(), format!("principal-{player}")];
    seed(&pool, player, &[&names[0], &names[1]]).await;
    let application = app(&pool, Some(base));
    let (status, body) = delete_account(&application, &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["state"], "pending");
    assert_eq!(
        Uuid::parse_str(body["requestId"].as_str().unwrap())
            .unwrap()
            .get_version_num(),
        7
    );
    let snapshot: Value =
        sqlx::query_scalar("SELECT subjects FROM erasure_requests WHERE player_id=$1")
            .bind(player)
            .fetch_one(&pool)
            .await
            .unwrap();
    let subjects = snapshot.as_array().unwrap();
    assert_eq!(subjects.len(), 2);
    for subject in subjects {
        assert!(names.contains(&subject["principal_id"].as_str().unwrap().to_string()));
        assert!(subject["request_id"].is_null());
    }
    let (status, replay) = delete_account(&application, &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, replay, "owned replay is the same operation");
    let auth = AuthErasure::new(
        "http://127.0.0.1:1".into(),
        ORGANIZATION_ID.into(),
        SECRET_KEY.into(),
    );
    let counts = crate::capabilities::identity_access::erasure::sweep(&pool, Some(&auth))
        .await
        .unwrap();
    assert_eq!(counts.pending, 1);
    assert_eq!(counts.completed, 0);
    assert!(stub.subjects().is_empty());
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 2);
    let reason: String =
        sqlx::query_scalar("SELECT last_reason FROM erasure_requests WHERE player_id=$1")
            .bind(player)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(reason, "money_preflight_unavailable");
}

#[tokio::test]
async fn legacy_subject_fallback_is_persisted_not_sent_before_preparation() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;
    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["state"], "pending");
    let subject: String = sqlx::query_scalar(
        "SELECT subjects->0->>'principal_id' FROM erasure_requests WHERE player_id=$1",
    )
    .bind(player)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(subject, format!("principal-{player}"));
    assert!(stub.subjects().is_empty());
    assert_eq!(preference_rows(&pool, player).await, 1);
}

#[tokio::test]
async fn an_unbound_auth_credential_refuses_the_erasure() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };

    let player = Uuid::now_v7();
    seed(&pool, player, &["usr_01kmp4wyhhfgxsyrjvh8e0tkkf"]).await;

    // Enable Auth not configured: the product's rows and the sign-in cannot
    // both be erased, so the deletion refuses rather than half-erasing.
    let (status, body) = delete_account(&app(&pool, None), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert!(message(&body).contains("identity_credential_unconfigured"));
    assert_diagnostic(&body, "erasure_unconfigured");
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);
}

#[tokio::test]
async fn the_confirmation_and_the_identity_are_checked_before_auth_is_called() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let shouter = app(&pool, Some(base));

    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;

    // Typing something other than DELETE erases nothing.
    let response = shouter
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(DELETE_PATH)
                .header("content-type", "application/json")
                .header(
                    "authorization",
                    format!("Bearer {}", token(&player.to_string())),
                )
                .body(Body::from(json!({"confirm": "delete"}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    // A request with no identity is refused too.
    let (status, _) = delete_account(&shouter, "").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    assert!(stub.seen.lock().unwrap().is_empty());
    assert_eq!(preference_rows(&pool, player).await, 1);
}

/// The player id of a bearer is what Auth is told about, and the api refuses
/// rather than guessing when it is not a player.
#[tokio::test]
async fn an_identity_that_is_not_a_player_id_erases_nothing() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;

    let (status, body) =
        delete_account(&app(&pool, Some(base)), &token("guest_not-a-player")).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    assert!(message(&body).contains("account_deletion_failed"));
    assert!(stub.seen.lock().unwrap().is_empty());
}

#[tokio::test]
async fn missing_product_database_has_a_fixed_diagnostic() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let (status, body) = delete_account(
        &router(AppState::new(None)),
        &token(&Uuid::now_v7().to_string()),
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_diagnostic(&body, "database_unavailable");
}

#[tokio::test]
async fn subject_lookup_failure_is_named_before_auth_or_product_erasure() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;
    // Only this test's disposable database: force the actual lookup failure.
    sqlx::query("ALTER TABLE auth_subjects RENAME TO auth_subjects_unavailable")
        .execute(&pool)
        .await
        .unwrap();
    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_diagnostic(&body, "subject_lookup_failed");
    assert!(stub.seen.lock().unwrap().is_empty());
    assert_eq!(preference_rows(&pool, player).await, 1);
}

#[tokio::test]
async fn money_failure_is_named_before_auth_or_product_erasure() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::answering(503, json!({"error":"unavailable"}));
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;
    let state = AppState::new(Some(pool.clone()))
        .with_money(Some(crate::capabilities::money::Money::new(
            &base,
            "fixture",
            "https://puzzled.test",
        )))
        .with_erasure(Some(AuthErasure::new(
            base,
            ORGANIZATION_ID.into(),
            SECRET_KEY.into(),
        )));
    let (status, body) = delete_account(&router(state), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_diagnostic(&body, "money_unavailable");
    assert!(stub.seen.lock().unwrap().is_empty());
    assert_eq!(preference_rows(&pool, player).await, 1);
}

#[tokio::test]
async fn unconfirmed_auth_absence_or_authority_keeps_product_rows() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    for (status, answer) in [
        (
            404,
            json!({"code":"not_found", "authority":"proxy", "error":"user not found"}),
        ),
        (
            202,
            json!({"privacy_request":{"request_id":"receipt-fixture", "organization_id":"other-org", "state":"pending", "request_type":"delete"}}),
        ),
        (
            202,
            json!({"privacy_request":{"request_id":"", "organization_id":ORGANIZATION_ID, "state":"pending", "request_type":"delete"}}),
        ),
        (403, json!({"error":"private-upstream-detail"})),
    ] {
        let stub = StubAuth::answering(status, answer);
        let base = spawn_auth(stub).await;
        let player = Uuid::now_v7();
        let subject = format!("subject-fixture-{player}");
        seed(&pool, player, &[&subject]).await;
        let auth = AuthErasure::new(base, ORGANIZATION_ID.into(), SECRET_KEY.into());
        let error = auth
            .request_delete(&subject, "stable-fixture")
            .await
            .err()
            .unwrap();
        assert!(!error.contains("private-upstream-detail"));
        assert_eq!(preference_rows(&pool, player).await, 1);
        assert_eq!(subject_rows(&pool, player).await, 1);
    }
}

#[tokio::test]
async fn a_real_wrong_route_html_404_preserves_preferences_subjects_and_consent() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    // No privacy route exists here. This is an actual HTTP HTML fallback,
    // not JSON encoded text, and cannot assert any account's absence.
    let wrong_route = Router::new().fallback(|| async {
        (
            StatusCode::NOT_FOUND,
            axum::response::Html("<html>route not found</html>"),
        )
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move { axum::serve(listener, wrong_route).await.unwrap() });
    let player = Uuid::now_v7();
    seed(&pool, player, &["subject-fixture"]).await;
    crate::capabilities::money::consent_db::record(
        &pool,
        &player.to_string(),
        "plus",
        "fixture-price",
        "en-US",
    )
    .await
    .unwrap();
    let before: Value =
        sqlx::query_scalar("SELECT to_jsonb(c) FROM checkout_consents c WHERE user_id=$1")
            .bind(player)
            .fetch_one(&pool)
            .await
            .unwrap();
    let auth = AuthErasure::new(
        format!("http://{addr}"),
        ORGANIZATION_ID.into(),
        SECRET_KEY.into(),
    );
    assert!(auth
        .request_delete("subject-fixture", "stable-fixture")
        .await
        .is_err());
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);
    let after: Value =
        sqlx::query_scalar("SELECT to_jsonb(c) FROM checkout_consents c WHERE user_id=$1")
            .bind(player)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(before, after);
    server.abort();
}

async fn seed_erasure_intent(pool: &PgPool, player: Uuid) -> Uuid {
    let operation = Uuid::now_v7();
    sqlx::query("INSERT INTO erasure_requests (request_id,player_id,suppression_hash,organization_id,subjects) VALUES ($1,$2,puzzled_erasure_player_hash($2),'org_test',$3)")
        .bind(operation).bind(player)
        .bind(json!([{"principal_id":"subject-fixture", "idempotency_key":"stable-fixture", "request_id":null, "state":null}]))
        .execute(pool).await.unwrap();
    operation
}

#[tokio::test]
async fn pending_and_completed_erasure_fences_everyday_writers_and_retains_consent() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;
    crate::capabilities::money::consent_db::record(
        &pool,
        &player.to_string(),
        "plus",
        "fixture-price",
        "en-US",
    )
    .await
    .unwrap();
    let operation = seed_erasure_intent(&pool, player).await;
    for statement in [
        "INSERT INTO account_attribution(user_id) VALUES($1)",
        "INSERT INTO auth_subjects(subject,user_id) VALUES('late-subject',$1)",
        "INSERT INTO family_groups(owner_user_id,invite_code) VALUES($1,'late-family')",
        "UPDATE notification_preferences SET last_daily_reminder_on='2026-10-01' WHERE user_id=$1",
    ] {
        assert!(sqlx::query(statement)
            .bind(player)
            .execute(&pool)
            .await
            .is_err());
    }
    let admitted: bool = sqlx::query_scalar("SELECT puzzled_erasure_try_admit($1)")
        .bind(player)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!admitted);
    crate::capabilities::preferences::adapters::account_deletion::delete_account_data(
        &pool,
        &player.to_string(),
    )
    .await
    .unwrap();
    let consent: Value = sqlx::query_scalar("SELECT to_jsonb(c) FROM checkout_consents c")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(consent["user_id"].is_null());
    assert_eq!(
        consent["statement"],
        crate::capabilities::money::consent_db::IMMEDIATE_SUPPLY_STATEMENT
    );
    assert_eq!(consent["plan_id"], "plus");
    sqlx::query("UPDATE erasure_requests SET state='completed',player_id=NULL,organization_id=NULL,subjects=NULL,local_erased_at=now(),completed_at=now() WHERE request_id=$1")
        .bind(operation).execute(&pool).await.unwrap();
    assert!(
        sqlx::query("INSERT INTO notification_preferences(user_id) VALUES($1)")
            .bind(player)
            .execute(&pool)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn old_repeatable_read_snapshots_cannot_admit_writers() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        .execute(&mut *tx)
        .await
        .unwrap();
    assert!(sqlx::query("SELECT puzzled_erasure_try_admit($1)")
        .bind(Uuid::now_v7())
        .execute(&mut *tx)
        .await
        .is_err());
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn already_dispatched_write_waits_for_intent_then_refuses_fresh_snapshot() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;
    let mut admission = pool.begin().await.unwrap();
    sqlx::query("SELECT puzzled_erasure_lock($1)")
        .bind(player)
        .execute(&mut *admission)
        .await
        .unwrap();
    let writer_pool = pool.clone();
    let writer = tokio::spawn(async move {
        sqlx::query("UPDATE notification_preferences SET push_enabled=true WHERE user_id=$1")
            .bind(player)
            .execute(&writer_pool)
            .await
    });
    sqlx::query("INSERT INTO erasure_requests(request_id,player_id,suppression_hash,organization_id,subjects) VALUES($1,$2,puzzled_erasure_player_hash($2),'org_test',$3)")
        .bind(Uuid::now_v7()).bind(player)
        .bind(json!([{"principal_id":"subject-fixture","idempotency_key":"stable-fixture","request_id":null,"state":null}]))
        .execute(&mut *admission).await.unwrap();
    admission.commit().await.unwrap();
    assert!(writer.await.unwrap().is_err());
}

#[tokio::test]
async fn consent_retention_expiry_replay_and_rollback_preserve_evidence() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let player = Uuid::now_v7();
    crate::capabilities::money::consent_db::record(
        &pool,
        &player.to_string(),
        "plus",
        "fixture-price",
        "en-US",
    )
    .await
    .unwrap();
    let original: Value = sqlx::query_scalar("SELECT to_jsonb(c) FROM checkout_consents c")
        .fetch_one(&pool)
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    crate::capabilities::preferences::adapters::account_deletion::erase_in_transaction(
        &mut tx, player,
    )
    .await
    .unwrap();
    let exact: bool = sqlx::query_scalar("SELECT retention_expires_at = (transaction_timestamp() AT TIME ZONE 'UTC') + interval '6 years' FROM checkout_consents").fetch_one(&mut *tx).await.unwrap();
    assert!(exact);
    tx.rollback().await.unwrap();
    let after: Value = sqlx::query_scalar("SELECT to_jsonb(c) FROM checkout_consents c")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        original, after,
        "failed local erasure changes no consent evidence"
    );
    crate::capabilities::preferences::adapters::account_deletion::delete_account_data(
        &pool,
        &player.to_string(),
    )
    .await
    .unwrap();
    let first: Value = sqlx::query_scalar("SELECT to_jsonb(c) FROM checkout_consents c")
        .fetch_one(&pool)
        .await
        .unwrap();
    crate::capabilities::preferences::adapters::account_deletion::delete_account_data(
        &pool,
        &player.to_string(),
    )
    .await
    .unwrap();
    let replay: Value = sqlx::query_scalar("SELECT to_jsonb(c) FROM checkout_consents c")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(first, replay, "replay must not extend expiry");
    let leap: String =
        sqlx::query_scalar("SELECT (timestamp '2024-02-29 23:12:13' + interval '6 years')::text")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(leap, "2030-02-28 23:12:13");
}

#[tokio::test]
async fn consent_retention_boundary_linked_rows_and_concurrent_skip_locked() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    use crate::capabilities::money::consent_db::{purge_expired_unlinked, record};
    let player = Uuid::now_v7();
    record(&pool, &player.to_string(), "plus", "fixture-price", "en-US")
        .await
        .unwrap();
    // Linked evidence is preserved even if its expiry happens to be past.
    sqlx::query("UPDATE checkout_consents SET retention_expires_at=timestamp '2000-01-01'")
        .execute(&pool)
        .await
        .unwrap();
    let mut lock = pool.begin().await.unwrap();
    let boundary: bool = sqlx::query_scalar("SELECT (statement_timestamp() AT TIME ZONE 'UTC') <= (statement_timestamp() AT TIME ZONE 'UTC')").fetch_one(&mut *lock).await.unwrap();
    assert!(boundary, "the expiry boundary is inclusive");
    let expired = Uuid::now_v7();
    let unlocked = Uuid::now_v7();
    let future = Uuid::now_v7();
    for (id, expiry) in [
        (expired, "2000-01-01"),
        (unlocked, "2000-01-02"),
        (future, "9999-01-01"),
    ] {
        sqlx::query("INSERT INTO checkout_consents(id,plan_id,price_key,locale,statement,retention_expires_at) VALUES($1,'plus','fixture','en-US','fixture',$2::text::timestamp)").bind(id).bind(expiry).execute(&pool).await.unwrap();
    }
    sqlx::query("SELECT id FROM checkout_consents WHERE id=$1 FOR UPDATE")
        .bind(expired)
        .execute(&mut *lock)
        .await
        .unwrap();
    assert_eq!(purge_expired_unlinked(&pool).await.unwrap(), 1);
    assert_eq!(purge_expired_unlinked(&pool).await.unwrap(), 0);
    lock.commit().await.unwrap();
    assert_eq!(purge_expired_unlinked(&pool).await.unwrap(), 1);
    let remaining: i64 = sqlx::query_scalar("SELECT count(*) FROM checkout_consents")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(remaining, 2, "linked and future evidence remain");
}
