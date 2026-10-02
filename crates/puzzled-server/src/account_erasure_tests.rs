//! Account erasure end to end: deleting an account in the app must also
//! delete the player's Sylphx Auth sign-in.
//!
//! The product's rows and the Auth subject are two halves of one person, so
//! `DeleteAccountData` deletes the rows and files Auth's privacy delete for
//! every subject that names the player inside one transaction, and commits
//! only after Auth accepted: a refusal or a failure rolls the rows back and
//! the request never reports a success it did not have. Needs `PUZZLED_TEST_DATABASE_URL` (a server where a
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
    /// Answers for the first requests, in order (status, body, delay before
    /// answering); then `status` and `answer`.
    script: Arc<Mutex<std::collections::VecDeque<(u16, Value, u64)>>>,
}

impl StubAuth {
    fn accepting() -> Self {
        Self {
            seen: Arc::default(),
            status: 202,
            answer: json!({"privacy_request": {"request_id": "privacy-request-1",
                                                "state": "accepted"}}),
            script: Arc::default(),
        }
    }

    fn answering(status: u16, answer: Value) -> Self {
        Self {
            seen: Arc::default(),
            status,
            answer,
            script: Arc::default(),
        }
    }

    /// Answer the first requests from `script` (status, body, delay in ms).
    fn scripted(self, script: Vec<(u16, Value, u64)>) -> Self {
        *self.script.lock().unwrap() = script.into();
        self
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

    /// The secret key each request carried.
    fn authorizations(&self) -> Vec<String> {
        self.seen
            .lock()
            .unwrap()
            .iter()
            .filter_map(|request| request["authorization"].as_str().map(str::to_string))
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
                let next = stub.script.lock().unwrap().pop_front();
                let (status, answer, delay) =
                    next.unwrap_or_else(|| (stub.status, stub.answer.clone(), 0));
                tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                (StatusCode::from_u16(status).unwrap(), Json(answer))
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
    let state = AppState::new(Some(pool.clone())).with_erasure(auth_url.map(|url| {
        AuthErasure::new(url, ORGANIZATION_ID.into(), SECRET_KEY.into())
            .with_timeout(std::time::Duration::from_millis(300))
    }));
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

#[tokio::test]
async fn every_subject_naming_the_player_loses_its_sign_in_with_the_rows() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;

    // The player is mid-migration: Auth still reports the old form as the
    // legacy subject while the new form is the one published.
    let player = Uuid::now_v7();
    seed(
        &pool,
        player,
        &[
            "usr_01kmp4wyhhfgxsyrjvh8e0tkkf",
            &format!("principal-{player}"),
        ],
    )
    .await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    // Both subject forms are named to Auth, under the instance secret key.
    let mut subjects = stub.subjects();
    subjects.sort();
    let mut expected = vec![
        "usr_01kmp4wyhhfgxsyrjvh8e0tkkf".to_string(),
        format!("principal-{player}"),
    ];
    expected.sort();
    assert_eq!(subjects, expected);
    assert_eq!(
        stub.authorizations(),
        vec![format!("Bearer {SECRET_KEY}"); 2]
    );

    // The rows are gone, the subject map included (it is part of the erasure).
    assert_eq!(preference_rows(&pool, player).await, 0);
    assert_eq!(subject_rows(&pool, player).await, 0);
}

#[tokio::test]
async fn a_player_with_no_subject_row_is_deleted_under_the_old_form() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;

    // Signed in before the subject map existed: no row, old form only.
    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(stub.subjects(), vec![format!("principal-{player}")]);
    assert_eq!(preference_rows(&pool, player).await, 0);
}

#[tokio::test]
async fn an_account_auth_does_not_hold_is_still_erased() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    // Auth holds no such account (already deleted, or never created).
    // Auth's own answer (identity-api `map_error` of NotFound("user not
    // found")); a bare 404 is ambiguous, not absence.
    let stub = StubAuth::answering(
        404,
        json!({"code": "not_found", "error": "user not found", "authority": "identity"}),
    );
    let base = spawn_auth(stub.clone()).await;

    let player = Uuid::now_v7();
    seed(&pool, player, &[]).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(stub.subjects(), vec![format!("principal-{player}")]);
    assert_eq!(preference_rows(&pool, player).await, 0);
}

#[tokio::test]
async fn a_refused_auth_deletion_leaves_every_row_in_place() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    // A definite refusal (a 4xx Auth decided on): the sign-in is intact.
    let stub = StubAuth::answering(403, json!({"error": "privacy_request_forbidden"}));
    let base = spawn_auth(stub.clone()).await;

    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert!(message(&body).contains("identity_account_deletion_failed"));
    // Nothing was erased: the account stays whole and the retry repeats the
    // same Auth request (its idempotency key is fixed per subject).
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);
    assert_eq!(stub.subjects(), vec![subject.to_string()]);
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

// --- Robustness: a database that fails mid-erasure (2026-10-02 incident) ---
//
// Faults are real server-side failures, not mocks: a trigger on
// `notification_preferences` terminates its own backend, so the api sees the
// connection die exactly as it did in production. `deferred` fires the
// trigger at COMMIT (after Auth accepted); otherwise it fires on the DELETE
// (before Auth is asked). The first `times` firings fail; a sequence counts
// them because it survives the rollback.

async fn inject_fault(pool: &PgPool, deferred: bool, times: i64) {
    sqlx::raw_sql(sqlx::AssertSqlSafe(format!(
        "CREATE SEQUENCE erasure_fault;
         CREATE FUNCTION erasure_fault() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN
           IF nextval('erasure_fault') <= {times} THEN
             PERFORM pg_terminate_backend(pg_backend_pid());
           END IF;
           RETURN OLD;
         END $$;
         {trigger}",
        trigger = if deferred {
            "CREATE CONSTRAINT TRIGGER erasure_fault AFTER DELETE ON notification_preferences
             DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erasure_fault();"
        } else {
            "CREATE TRIGGER erasure_fault BEFORE DELETE ON notification_preferences
             FOR EACH ROW EXECUTE FUNCTION erasure_fault();"
        }
    )))
    .execute(pool)
    .await
    .unwrap();
}

async fn clear_fault(pool: &PgPool) {
    sqlx::raw_sql("DROP TRIGGER erasure_fault ON notification_preferences")
        .execute(pool)
        .await
        .unwrap();
}

async fn fault_firings(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT last_value FROM erasure_fault")
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn erase_player_command(pool: &PgPool, base: &str, args: &[&str]) -> (i32, Value) {
    use crate::capabilities::preferences::erase_player::{parse, run};
    let args: Vec<String> = args.iter().map(|s| (*s).to_string()).collect();
    let command = parse(&args).unwrap();
    let auth = AuthErasure::new(base.to_string(), ORGANIZATION_ID.into(), SECRET_KEY.into());
    let mut out = Vec::new();
    let code = run(&command, pool, None, Some(&auth), &mut out).await;
    let text = String::from_utf8(out).unwrap();
    for arg in &args {
        if arg.starts_with("usr_") || arg.starts_with("principal-") {
            assert!(
                !text.contains(arg.as_str()),
                "the report names a subject: {text}"
            );
        }
    }
    (code, serde_json::from_str(text.trim()).unwrap())
}

#[tokio::test]
async fn a_connection_reset_at_commit_is_retried_and_the_erasure_completes() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;
    // The first commit dies after Auth accepted: the incident's window.
    inject_fault(&pool, true, 1).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        fault_firings(&pool).await,
        2,
        "one failed commit, one retried"
    );
    // Auth was asked once: the retry does not file a second request.
    assert_eq!(stub.subjects(), vec![subject.to_string()]);
    assert_eq!(preference_rows(&pool, player).await, 0);
    assert_eq!(subject_rows(&pool, player).await, 0);
}

#[tokio::test]
async fn a_database_that_keeps_failing_before_auth_erases_nothing_and_keeps_the_sign_in() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;
    inject_fault(&pool, false, 1_000).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE, "{body}");
    assert!(message(&body).contains("account_deletion_unavailable"));
    // Bounded: four attempts, then a retryable refusal.
    assert_eq!(fault_firings(&pool).await, 4);
    // No partial state, and Auth was never asked: the person can still sign
    // in and repeat the request.
    assert!(stub.subjects().is_empty());
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);
}

#[tokio::test]
async fn a_commit_that_keeps_failing_after_auth_leaves_the_rows_whole_for_erase_player() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;
    inject_fault(&pool, true, 1_000).await;

    let (status, body) =
        delete_account(&app(&pool, Some(base.clone())), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    assert!(message(&body).contains("account_deletion_failed"));
    assert_eq!(fault_firings(&pool).await, 4);
    // All or nothing: every row and the subject map survive, so the subject
    // still names the player for the operator's recovery.
    assert_eq!(stub.subjects(), vec![subject.to_string()]);
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);

    // The database recovers; the operator finishes the erasure by subject.
    clear_fault(&pool).await;
    let (code, report) = erase_player_command(&pool, &base, &["--subject", subject]).await;
    assert_eq!(code, 0, "{report}");
    assert_eq!(report["outcome"], "erased");
    assert_eq!(report["player_found"], true);
    assert_eq!(report["rows_deleted"], 2, "{report}");
    assert_eq!(preference_rows(&pool, player).await, 0);
    assert_eq!(subject_rows(&pool, player).await, 0);
    // Auth was named the same subject again (same idempotency key).
    assert_eq!(stub.subjects(), vec![subject.to_string(); 2]);
}

#[tokio::test]
async fn a_second_erasure_is_a_no_op() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::accepting();
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    let (status, body) =
        delete_account(&app(&pool, Some(base.clone())), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["rowsDeleted"], "2", "{body}");

    // Rows-only erasure again: nothing left.
    let again = crate::capabilities::preferences::adapters::account_deletion::delete_account_data(
        &pool,
        &player.to_string(),
    )
    .await;
    assert_eq!(again, Ok(0));
    // The operator command again: the subject no longer names a player, so
    // only Auth is asked (it answers the same request), and nothing is deleted.
    let (code, report) = erase_player_command(&pool, &base, &["--subject", subject]).await;
    assert_eq!(code, 0, "{report}");
    assert_eq!(report["player_found"], false);
    assert_eq!(report["rows_deleted"], 0);
    assert_eq!(report["outcome"], "sign_in_only");
}

#[tokio::test]
async fn erase_player_dry_run_counts_and_changes_nothing() {
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

    // An old-form subject with no map row still names its player.
    let subject = format!("principal-{player}");
    let (code, report) =
        erase_player_command(&pool, &base, &["--dry-run", "--subject", &subject]).await;
    assert_eq!(code, 0, "{report}");
    assert_eq!(report["outcome"], "dry_run");
    assert_eq!(report["rows_found"], 1);
    assert!(stub.subjects().is_empty());
    assert_eq!(preference_rows(&pool, player).await, 1);

    let (code, report) = erase_player_command(&pool, &base, &["--subject", &subject]).await;
    assert_eq!(code, 0, "{report}");
    assert_eq!(report["rows_deleted"], 1);
    assert_eq!(stub.subjects(), vec![subject.clone()]);
    assert_eq!(preference_rows(&pool, player).await, 0);
}

#[tokio::test]
async fn erase_player_refuses_while_auth_refuses_and_erases_nothing() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::answering(403, json!({"error": "privacy_request_forbidden"}));
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    let (code, report) = erase_player_command(&pool, &base, &["--subject", subject]).await;
    assert_eq!(code, 6, "{report}");
    assert_eq!(report["outcome"], "auth_refused");
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);
}

// --- Ambiguous Auth answers: Auth may have deleted the sign-in ---

fn accepted(id: &str) -> Value {
    json!({"privacy_request": {"request_id": id, "state": "accepted"}})
}

#[tokio::test]
async fn an_auth_timeout_is_retried_with_the_same_request_and_the_erasure_completes() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    // Auth records the request, then answers too late (past the 300 ms
    // timeout): it may have accepted it. The second answer is in time.
    let stub = StubAuth::accepting().scripted(vec![(202, accepted("privacy-request-1"), 2_000)]);
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    // Asked twice, with one fixed idempotency key: one request at Auth.
    assert_eq!(stub.subjects(), vec![subject.to_string(); 2]);
    let keys: Vec<Value> = stub
        .seen
        .lock()
        .unwrap()
        .iter()
        .map(|r| r["body"]["idempotency_key"].clone())
        .collect();
    assert_eq!(keys[0], keys[1]);
    assert_eq!(preference_rows(&pool, player).await, 0);
    assert_eq!(subject_rows(&pool, player).await, 0);
}

#[tokio::test]
async fn auth_that_keeps_answering_503_leaves_the_rows_whole_and_says_run_erase_player() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    // Auth records every request and answers 503: it may have suspended the
    // person anyway, so this is not a clean, retryable refusal.
    let stub = StubAuth::answering(503, json!({"error": "identity_unavailable"}));
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    assert!(message(&body).contains("account_deletion_failed"));
    // Bounded: four attempts, the same subject each time.
    assert_eq!(stub.subjects(), vec![subject.to_string(); 4]);
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);

    // Auth recovers; the operator finishes it by subject.
    let healthy = StubAuth::accepting();
    let base = spawn_auth(healthy.clone()).await;
    let (code, report) = erase_player_command(&pool, &base, &["--subject", subject]).await;
    assert_eq!(code, 0, "{report}");
    assert_eq!(report["outcome"], "erased");
    assert_eq!(preference_rows(&pool, player).await, 0);
    assert_eq!(subject_rows(&pool, player).await, 0);
}

#[tokio::test]
async fn a_refusal_after_another_subject_was_accepted_is_not_a_clean_refusal() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    // Two subjects: Auth accepts the first, then refuses the second.
    let stub = StubAuth::answering(403, json!({"error": "privacy_request_forbidden"}))
        .scripted(vec![(202, accepted("privacy-request-1"), 0)]);
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let legacy = format!("principal-{player}");
    seed(&pool, player, &["usr_01kmp4wyhhfgxsyrjvh8e0tkkf", &legacy]).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    assert!(message(&body).contains("account_deletion_failed"));
    assert_eq!(stub.subjects().len(), 2);
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 2);
}

#[tokio::test]
async fn erase_player_reports_an_unconfirmed_sign_in_and_erases_no_row() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let stub = StubAuth::answering(502, json!({"error": "bad_gateway"}));
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    let (code, report) = erase_player_command(&pool, &base, &["--subject", subject]).await;
    assert_eq!(code, 6, "{report}");
    assert_eq!(report["outcome"], "sign_in_unconfirmed");
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);
}

#[tokio::test]
async fn a_404_that_is_not_auths_own_keeps_the_rows_and_says_run_erase_player() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    // A misrouted SYLPHX_AUTH_URL answers 404 at a proxy: nothing says the
    // sign-in is gone, so the rows must not go either.
    let stub = StubAuth::answering(404, json!({"error": "not_found"}));
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    let (status, body) = delete_account(&app(&pool, Some(base)), &token(&player.to_string())).await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    assert!(message(&body).contains("account_deletion_failed"));
    assert_eq!(stub.subjects(), vec![subject.to_string(); 4]);
    assert_eq!(preference_rows(&pool, player).await, 1);
    assert_eq!(subject_rows(&pool, player).await, 1);
}

/// Log lines written while a guard from [`capture_logs`] is held, on this
/// thread (a current-thread test runtime runs spawned tasks here too).
#[derive(Clone, Default)]
struct Logs(Arc<Mutex<Vec<u8>>>);

impl std::io::Write for Logs {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.0.lock().unwrap().extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Logs {
    fn text(&self) -> String {
        String::from_utf8_lossy(&self.0.lock().unwrap()).into_owned()
    }
}

fn capture_logs(logs: &Logs) -> tracing::subscriber::DefaultGuard {
    let logs = logs.clone();
    tracing::subscriber::set_default(
        tracing_subscriber::fmt()
            .with_ansi(false)
            .with_max_level(tracing::Level::INFO)
            .with_writer(move || logs.clone())
            .finish(),
    )
}

#[tokio::test]
async fn a_client_that_hangs_up_mid_erase_does_not_cancel_the_erasure() {
    let _key = test_key_lock()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let Some(pool) = fresh_database().await else {
        return;
    };
    let logs = Logs::default();
    let _logs = capture_logs(&logs);
    // Auth accepts, but slowly (within the 300 ms timeout).
    let stub = StubAuth::accepting().scripted(vec![(202, accepted("privacy-request-1"), 250)]);
    let base = spawn_auth(stub.clone()).await;
    let player = Uuid::now_v7();
    let subject = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    seed(&pool, player, &[subject]).await;

    // The client gives up while Auth is still deciding: the handler future
    // is dropped with the transaction open and Auth's answer unread.
    let app = app(&pool, Some(base));
    let bearer = token(&player.to_string());
    let request = delete_account(&app, &bearer);
    tokio::pin!(request);
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
    while stub.subjects().is_empty() {
        tokio::select! {
            answer = &mut request => panic!("answered before Auth was asked: {answer:?}"),
            () = tokio::time::sleep(std::time::Duration::from_millis(5)) => {}
        }
        assert!(
            tokio::time::Instant::now() < deadline,
            "Auth was never asked"
        );
    }
    drop(request);
    assert_eq!(preference_rows(&pool, player).await, 1, "not committed yet");

    // The erase still runs to its commit and logs it.
    while !logs.text().contains("account data erased") {
        assert!(
            tokio::time::Instant::now() < deadline,
            "the erase did not finish: {}",
            logs.text()
        );
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    assert!(logs
        .text()
        .contains("sylphx auth account deletion requested"));
    assert_eq!(stub.subjects(), vec![subject.to_string()]);
    assert_eq!(preference_rows(&pool, player).await, 0);
    assert_eq!(subject_rows(&pool, player).await, 0);
}
