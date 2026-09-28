//! Sylphx Auth end-user sessions through the real router, against a fake Auth.

use std::sync::atomic::{AtomicU16, AtomicUsize, Ordering};
use std::sync::Arc;

use axum::body::Body;
use axum::http::{HeaderMap, Method, Request, StatusCode};
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use tower::ServiceExt;

use crate::capabilities::identity_access::adapters::auth_session::{
    encode_identity, AuthSessions, VERIFIED_IDENTITY_HEADER,
};
use crate::capabilities::identity_access::adapters::platform_jwt::VerifiedIdentity;
use crate::shared::pages::capture::{capture, count, logged};
use crate::shared::pages::{events, FailureStreak};
use crate::{router, AppState};

const GOOD: &str = "identity_org_session_good";

async fn spawn_fake_auth(calls: Arc<AtomicUsize>) -> String {
    let app = Router::new().route(
        "/v1/sessions/current",
        get(move |headers: HeaderMap| {
            let calls = calls.clone();
            async move {
                calls.fetch_add(1, Ordering::SeqCst);
                let bearer = headers
                    .get("authorization")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                let agent = headers
                    .get("user-agent")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                if bearer == format!("Bearer {GOOD}") && agent == "Browser/1.0" {
                    (
                        StatusCode::OK,
                        Json(json!({"session": {"principal": {
                        "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
                        "display_name": "Ada", "primary_email": "ada@example.com",
                        "state": "active"}}})),
                    )
                } else {
                    (
                        StatusCode::UNAUTHORIZED,
                        Json(json!({"error": "unauthenticated"})),
                    )
                }
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

async fn subscription(app: &Router, headers: &[(&str, String)]) -> (StatusCode, Value) {
    let mut request = Request::builder()
        .method(Method::POST)
        .uri("/puzzled.v1.BillingService/GetSubscription")
        .header("content-type", "application/json");
    if !headers.iter().any(|(name, _)| *name == "user-agent") {
        request = request.header("user-agent", "Browser/1.0");
    }
    for (name, value) in headers {
        request = request.header(*name, value);
    }
    let response = app
        .clone()
        .oneshot(request.body(Body::from("{}")).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn auth_sessions_sign_players_in_and_forged_headers_do_not() {
    let calls = Arc::new(AtomicUsize::new(0));
    let base = spawn_fake_auth(calls.clone()).await;
    let app = router(AppState::new(None).with_auth(AuthSessions::new(base)));

    // The web's session cookie is verified with Auth.
    let cookie = ("cookie", format!("x=1; sylphx_identity_session={GOOD}"));
    let (status, body) = subscription(&app, std::slice::from_ref(&cookie)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    // A bearer works too, and the answer is cached (one Auth call so far).
    let (status, _) = subscription(&app, &[("authorization", format!("Bearer {GOOD}"))]).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        calls.load(Ordering::SeqCst),
        1,
        "second check is served from cache"
    );

    // A session Auth refuses is not signed in.
    let bad = (
        "cookie",
        "sylphx_identity_session=identity_org_session_revoked".to_string(),
    );
    let (status, _) = subscription(&app, &[bad]).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // The same session from another User-Agent is refused (Auth binds it).
    let (status, _) = subscription(
        &app,
        &[
            ("authorization", format!("Bearer {GOOD}")),
            ("user-agent", "Other/2.0".to_string()),
        ],
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // A client cannot set the internal header itself.
    let forged = encode_identity(&VerifiedIdentity {
        user_id: "0199aa10-7b2c-7d3e-8f00-1234567890ab".into(),
        display_name: None,
        email: None,
        is_admin: true,
    })
    .unwrap();
    let (status, _) = subscription(
        &app,
        &[(
            VERIFIED_IDENTITY_HEADER,
            forged.to_str().unwrap().to_string(),
        )],
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

/// The Auth subject to player map against a real database: both subject forms
/// reach the same player, the new form is never decoded, and the id map export
/// links a player whose subject changed while they were away.
#[tokio::test]
async fn both_auth_subject_forms_reach_the_same_player() {
    use crate::capabilities::identity_access::adapters::auth_subjects::{
        player_for, LINK_FROM_ID_MAP, SPLIT_PLAYERS_AFTER_LINK,
    };
    let Some(pool) = crate::billing_flow_tests::fresh_database().await else {
        return;
    };
    const OLD: &str = "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab";
    const NEW: &str = "usr_01kmp4wyhhfgxsyrjvh8e0tkkf";
    let existing = uuid::Uuid::parse_str("0199aa10-7b2c-7d3e-8f00-1234567890ab").unwrap();

    // Today's form keeps the player id Puzzled always derived, now as a row.
    assert_eq!(player_for(&pool, OLD, None).await.unwrap(), existing);
    assert_eq!(player_for(&pool, OLD, None).await.unwrap(), existing);

    // After Auth's cut the new form, with the legacy subject, is the same player.
    assert_eq!(player_for(&pool, NEW, Some(OLD)).await.unwrap(), existing);
    // And stays so without it.
    assert_eq!(player_for(&pool, NEW, None).await.unwrap(), existing);

    // A new person gets a fresh UUIDv7, stable across sign-ins.
    let fresh = player_for(&pool, "usr_01kmp4wyhhfgxsyrjvh8e0tkkg", None)
        .await
        .unwrap();
    assert_eq!(fresh.get_version_num(), 7);
    assert_eq!(
        player_for(&pool, "usr_01kmp4wyhhfgxsyrjvh8e0tkkg", None)
            .await
            .unwrap(),
        fresh
    );

    // A player away through the cut: linked from the id map export. One who
    // was first seen in the new form without the legacy subject is listed.
    let away_old = "principal-0199aa10-7b2c-7d3e-8f00-00000000000a";
    let away_new = "usr_01kmp4wyhhfgxsyrjvh8e0t00a";
    let split_old = "principal-0199aa10-7b2c-7d3e-8f00-00000000000b";
    let split_new = "usr_01kmp4wyhhfgxsyrjvh8e0t00b";
    let split_player = player_for(&pool, split_new, None).await.unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("CREATE TEMP TABLE id_map_import (old_text text, new_text text) ON COMMIT DROP")
        .execute(&mut *tx)
        .await
        .unwrap();
    for (old, new) in [(OLD, NEW), (away_old, away_new), (split_old, split_new)] {
        sqlx::query("INSERT INTO id_map_import VALUES ($1, $2)")
            .bind(old)
            .bind(new)
            .execute(&mut *tx)
            .await
            .unwrap();
    }
    sqlx::query(LINK_FROM_ID_MAP)
        .execute(&mut *tx)
        .await
        .unwrap();
    let split: Vec<(String, String)> = sqlx::query_as(sqlx::AssertSqlSafe(format!(
        "SELECT old_text, new_text FROM ({SPLIT_PLAYERS_AFTER_LINK}) q"
    )))
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(split, [(split_old.to_string(), split_new.to_string())]);
    assert_eq!(
        player_for(&pool, away_new, None).await.unwrap(),
        uuid::Uuid::parse_str("0199aa10-7b2c-7d3e-8f00-00000000000a").unwrap()
    );
    assert_eq!(
        player_for(&pool, split_new, None).await.unwrap(),
        split_player
    );
}

/// A fake Auth that answers every session read with the status in `status`.
async fn spawn_status_auth(status: Arc<AtomicU16>) -> String {
    let app = Router::new().route(
        "/v1/sessions/current",
        get(move || {
            let code = StatusCode::from_u16(status.load(Ordering::SeqCst)).unwrap();
            async move {
                if code == StatusCode::OK {
                    (
                        code,
                        Json(json!({"session": {"principal": {
                        "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
                        "state": "active"}}})),
                    )
                } else {
                    (code, Json(json!({"error": "no"})))
                }
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

/// Both sign-in paths count on one streak: the default is the shared static.
#[test]
fn auth_sessions_count_on_the_shared_signin_streak() {
    let sessions = AuthSessions::new("http://127.0.0.1:1".into());
    assert!(std::ptr::eq(
        sessions.streak(),
        &crate::shared::pages::SIGNIN_UNAVAILABLE
    ));
}

#[tokio::test]
async fn auth_outage_pages_once_and_a_refusal_never_counts() {
    // A streak of its own, so parallel tests cannot reset this count.
    let streak: &'static FailureStreak =
        Box::leak(Box::new(FailureStreak::new(events::SIGNIN_UNAVAILABLE, 5)));
    let (buffer, _guard) = capture();
    let status = Arc::new(AtomicU16::new(500));
    let base = spawn_status_auth(status.clone()).await;
    let sessions = AuthSessions::new(base).with_streak(streak);
    let token = |n: usize| format!("identity_org_session_{n}");

    // Refusals are answers: Auth is up, this token is not.
    status.store(401, Ordering::SeqCst);
    for n in 0..10 {
        assert!(sessions.verify(&token(n), "UA").await.is_none());
    }
    status.store(403, Ordering::SeqCst);
    for n in 10..20 {
        assert!(sessions.verify(&token(n), "UA").await.is_none());
    }
    assert_eq!(count(&logged(&buffer), "severity=\"page\""), 0);

    // Auth answering 500 for five different tokens (cache misses) pages once.
    status.store(500, Ordering::SeqCst);
    for n in 100..104 {
        assert!(sessions.verify(&token(n), "UA").await.is_none());
    }
    assert_eq!(count(&logged(&buffer), "severity=\"page\""), 0);
    assert!(sessions.verify(&token(104), "UA").await.is_none());
    let out = logged(&buffer);
    assert_eq!(count(&out, "severity=\"page\""), 1);
    assert!(out.contains("event=\"puzzled_signin_unavailable\""));
    assert!(out.contains("detail=\"http_5xx\""));
    assert!(out.contains("failures=5"));

    // Still down: one page per incident.
    assert!(sessions.verify(&token(105), "UA").await.is_none());
    assert_eq!(count(&logged(&buffer), "severity=\"page\""), 1);

    // A 200 recovers, once.
    status.store(200, Ordering::SeqCst);
    assert!(sessions.verify(&token(200), "UA").await.is_some());
    assert_eq!(
        count(&logged(&buffer), "puzzled_signin_unavailable_recovered"),
        1
    );
}

#[tokio::test]
async fn auth_not_answering_counts_as_unreachable() {
    let streak: &'static FailureStreak =
        Box::leak(Box::new(FailureStreak::new(events::SIGNIN_UNAVAILABLE, 2)));
    let (buffer, _guard) = capture();
    // Nothing listens on port 1: the request never reaches Auth.
    let sessions = AuthSessions::new("http://127.0.0.1:1".into()).with_streak(streak);
    for n in 0..2 {
        assert!(sessions
            .verify(&format!("identity_org_session_{n}"), "UA")
            .await
            .is_none());
    }
    let out = logged(&buffer);
    assert_eq!(count(&out, "severity=\"page\""), 1);
    assert!(out.contains("detail=\"unreachable\""));
}
