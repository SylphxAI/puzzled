//! Signed-link consent through the real Connect router and a throwaway database.
#![allow(clippy::unwrap_used)]

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use hmac::{Hmac, KeyInit, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use tower::ServiceExt;
use uuid::Uuid;

use crate::capabilities::preferences::unsubscribe::UnsubscribeTokens;
use crate::test_support::fresh_database;
use crate::{router, AppState};

const KEY: &str = "test-unsubscribe-key";

fn signed_token(user: Uuid, issued: i64) -> String {
    let mut n = issued as u64;
    let mut digits = Vec::new();
    while n > 0 {
        digits.push(b"0123456789abcdefghijklmnopqrstuvwxyz"[(n % 36) as usize]);
        n /= 36;
    }
    digits.reverse();
    let data = format!("{user}.{}", String::from_utf8(digits).unwrap());
    let mut mac = Hmac::<Sha256>::new_from_slice(KEY.as_bytes()).unwrap();
    mac.update(data.as_bytes());
    let signature: String = mac.finalize().into_bytes()[..8]
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    format!("{data}.{signature}")
}

async fn unsubscribe(app: &axum::Router, token: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/puzzled.v1.PreferencesService/UnsubscribeEmail")
                .header("content-type", "application/json")
                .body(Body::from(json!({"token": token}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
async fn valid_link_unsubscribes_idempotently_without_session_and_preserves_other_consent() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    sqlx::query("INSERT INTO notification_preferences (user_id, email_marketing, email_weekly_digest, push_enabled) VALUES ($1, true, false, false)")
        .bind(user).execute(&pool).await.unwrap();
    let mut state = AppState::new(Some(pool.clone()));
    state.unsubscribe = Some(UnsubscribeTokens::new(KEY.into()));
    let app = router(state);
    let token = signed_token(user, chrono::Utc::now().timestamp_millis());
    for _ in 0..2 {
        assert_eq!(unsubscribe(&app, &token).await.0, StatusCode::OK);
    }
    let prefs: (bool, bool, bool) = sqlx::query_as("SELECT email_marketing, email_weekly_digest, push_enabled FROM notification_preferences WHERE user_id = $1")
        .bind(user).fetch_one(&pool).await.unwrap();
    assert_eq!(prefs, (false, false, false));
    let new_user = Uuid::now_v7();
    assert_eq!(
        unsubscribe(
            &app,
            &signed_token(new_user, chrono::Utc::now().timestamp_millis())
        )
        .await
        .0,
        StatusCode::OK
    );
    let marketing: bool = sqlx::query_scalar(
        "SELECT email_marketing FROM notification_preferences WHERE user_id = $1",
    )
    .bind(new_user)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(!marketing);
    pool.close().await;
}

#[tokio::test]
async fn forged_and_expired_links_are_refused_before_any_write() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let user = Uuid::now_v7();
    let mut state = AppState::new(Some(pool.clone()));
    state.unsubscribe = Some(UnsubscribeTokens::new(KEY.into()));
    let app = router(state);
    let now = chrono::Utc::now().timestamp_millis();
    let forged = signed_token(user, now).replace(&user.to_string(), &Uuid::now_v7().to_string());
    let expired = signed_token(user, now - 31 * 24 * 60 * 60 * 1_000);
    for token in [forged, expired] {
        let (status, body) = unsubscribe(&app, &token).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["message"], "invalid_unsubscribe_token");
    }
    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM notification_preferences")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(rows, 0);
    pool.close().await;
}

#[tokio::test]
async fn missing_key_or_database_never_claims_success() {
    let mut state = AppState::new(None);
    state.unsubscribe = None;
    assert_eq!(
        unsubscribe(&router(state.clone()), "anything").await.0,
        StatusCode::SERVICE_UNAVAILABLE
    );
    state.unsubscribe = Some(UnsubscribeTokens::new(KEY.into()));
    let token = signed_token(Uuid::now_v7(), chrono::Utc::now().timestamp_millis());
    assert_eq!(
        unsubscribe(&router(state), &token).await.0,
        StatusCode::SERVICE_UNAVAILABLE
    );
}
