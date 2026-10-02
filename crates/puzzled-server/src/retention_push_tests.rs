//! Retention persistence regression tests on a throwaway migrated database.
use crate::capabilities::preferences::adapters::{account_deletion::delete_account_data, web_push};
use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    adopt_guest_sessions, persist_validated_session,
};
use crate::test_support::fresh_database;
use chrono::NaiveDate;
use uuid::Uuid;

#[tokio::test]
async fn browser_subscription_is_idempotent_player_scoped_and_erased() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let first = Uuid::now_v7();
    let second = Uuid::now_v7();
    let endpoint = "https://fcm.googleapis.com/fcm/send/browser-one";
    web_push::save(&pool, first, endpoint, "public-key", "auth-key", "zh-HK")
        .await
        .unwrap();
    web_push::save(&pool, first, endpoint, "public-key", "auth-key", "zh-HK")
        .await
        .unwrap();
    let (id, owner, count): (Uuid, Uuid, i64) = sqlx::query_as(
        "SELECT id, user_id, count(*) OVER () FROM push_subscriptions WHERE endpoint = $1",
    )
    .bind(endpoint)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(id.get_version_num(), 7);
    assert_eq!(owner, first);
    assert_eq!(count, 1);
    // Another player cannot unsubscribe someone else's endpoint.
    assert!(matches!(
        web_push::remove(&pool, second, endpoint).await,
        Err(sqlx::Error::RowNotFound)
    ));
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM push_subscriptions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    // Knowing a browser endpoint does not authorize transferring its owner.
    assert!(matches!(
        web_push::save(
            &pool,
            second,
            endpoint,
            "rotated-public-key",
            "rotated-auth-key",
            "zh-TW",
        )
        .await,
        Err(sqlx::Error::RowNotFound)
    ));
    let stored: (Uuid, String, String) =
        sqlx::query_as("SELECT user_id, p256dh, auth FROM push_subscriptions")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stored, (first, "public-key".into(), "auth-key".into()));
    let preference_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM user_preferences WHERE user_id = $1")
            .bind(second)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(preference_count, 0);
    delete_account_data(&pool, &first.to_string())
        .await
        .unwrap();
    // The new account registers a fresh endpoint, never silently transfers it.
    let endpoint = "https://fcm.googleapis.com/fcm/send/browser-two";
    web_push::save(&pool, second, endpoint, "public-key", "auth-key", "zh-HK")
        .await
        .unwrap();
    delete_account_data(&pool, &second.to_string())
        .await
        .unwrap();
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM push_subscriptions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn existing_guest_claim_carries_two_days_and_today_once() {
    let Some(pool) = fresh_database().await else {
        return;
    };
    let credential_cookie =
        crate::capabilities::identity_access::adapters::guest_credentials::issue(&pool)
            .await
            .unwrap();
    let token = credential_cookie
        .split(';')
        .next()
        .unwrap()
        .split_once('=')
        .unwrap()
        .1;
    let hash = crate::capabilities::identity_access::adapters::guest_credentials::token_hash(token)
        .unwrap();
    let guest_id = crate::capabilities::identity_access::adapters::guest_credentials::lookup_hash(
        &pool, &hash,
    )
    .await
    .unwrap()
    .unwrap();
    let guest = format!("guest_{guest_id}");
    let account = Uuid::now_v7().to_string();
    sqlx::query("INSERT INTO auth_subjects (subject, user_id) VALUES ($1, $2)")
        .bind(format!("principal-{account}"))
        .bind(Uuid::parse_str(&account).unwrap())
        .execute(&pool)
        .await
        .unwrap();
    let verified_account = crate::VerifiedIdentity {
        user_id: account.clone(),
        display_name: None,
        email: None,
        is_admin: false,
        actor: None,
    };
    for day in [29, 30] {
        let date = NaiveDate::from_ymd_opt(2026, 9, day).unwrap();
        persist_validated_session(
            &pool,
            &guest,
            "word-guess",
            None,
            "daily",
            "won",
            Some(100),
            1,
            1000,
            None,
            Some(date),
            Some(date),
            date.and_hms_opt(12, 0, 0)
                .unwrap()
                .and_utc()
                .timestamp_millis(),
        )
        .await
        .unwrap();
    }
    assert_eq!(
        adopt_guest_sessions(&pool, &verified_account, &guest, &hash)
            .await
            .unwrap(),
        2
    );
    assert!(
        adopt_guest_sessions(&pool, &verified_account, &guest, &hash)
            .await
            .is_err()
    );
    let days: Vec<String> =
        sqlx::query_scalar("SELECT day_key FROM game_sessions WHERE user_id = $1 ORDER BY day_key")
            .bind(Uuid::parse_str(&account).unwrap())
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(days, ["2026-09-29", "2026-09-30"]);
}

#[tokio::test]
async fn sender_outcomes_preserve_live_endpoints_and_prune_expired_ones() {
    use crate::capabilities::preferences::adapters::web_push_sender::{PushDelivery, PushSender};
    use ::web_push::SubscriptionInfo;
    struct TestSender;
    impl PushSender for TestSender {
        async fn send<'a>(
            &'a self,
            subscription: &'a SubscriptionInfo,
            payload: &'a str,
        ) -> Result<PushDelivery, String> {
            assert!(payload.contains("每日謎題"));
            if subscription.endpoint.ends_with("expired") {
                Ok(PushDelivery::Expired)
            } else if subscription.endpoint.ends_with("failed") {
                Err("transient failure".to_string())
            } else {
                Ok(PushDelivery::Delivered)
            }
        }
    }
    let Some(pool) = fresh_database().await else {
        return;
    };
    let player = Uuid::now_v7();
    let mut subscriptions = Vec::new();
    for suffix in ["live", "expired", "failed"] {
        let endpoint = format!("https://fcm.googleapis.com/fcm/send/{suffix}");
        web_push::save(&pool, player, &endpoint, "public-key", "auth-key", "zh-HK")
            .await
            .unwrap();
        subscriptions.push(SubscriptionInfo::new(
            endpoint,
            "public-key".to_string(),
            "auth-key".to_string(),
        ));
    }
    let payload = web_push::reminder_payload("zh-HK").to_string();
    assert!(
        web_push::deliver_subscriptions(&pool, player, subscriptions, &payload, &TestSender)
            .await
            .is_ok()
    );
    let endpoints: Vec<String> = sqlx::query_scalar(
        "SELECT endpoint FROM push_subscriptions WHERE user_id = $1 ORDER BY endpoint",
    )
    .bind(player)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(endpoints.len(), 2);
    assert!(endpoints.iter().any(|endpoint| endpoint.ends_with("live")));
    assert!(endpoints
        .iter()
        .any(|endpoint| endpoint.ends_with("failed")));
}

#[tokio::test]
async fn delivery_before_ack_crash_explicitly_allows_at_least_once_retry() {
    use crate::capabilities::jobs::adapters::jobs_db::{
        acknowledge_daily_reminder, claim_due_daily_reminders, REMINDER_LEASE_SECONDS,
    };
    let Some(pool) = crate::daily_reminder_tests::reminder_database().await else {
        return;
    };
    sqlx::query("INSERT INTO notification_preferences (user_id, push_enabled, push_daily_reminder, daily_reminder_time, timezone) VALUES ($1, true, true, '08:00', 'UTC')")
        .bind(Uuid::now_v7()).execute(&pool).await.unwrap();
    let now = "2026-10-01T08:00:00Z".parse().unwrap();
    let first = claim_due_daily_reminders(&pool, now, "2026-10-01")
        .await
        .unwrap()
        .remove(0);
    // Treat external delivery as successful, then lose the worker before ack.
    // No database fact can distinguish that from a crash before delivery.
    let expiry = now + chrono::Duration::seconds(REMINDER_LEASE_SECONDS);
    let second = claim_due_daily_reminders(&pool, expiry, "2026-10-01")
        .await
        .unwrap()
        .remove(0);
    assert_eq!(first.user_id, second.user_id);
    assert_ne!(first.token, second.token);
    assert!(!acknowledge_daily_reminder(&pool, &first, expiry)
        .await
        .unwrap());
    assert!(acknowledge_daily_reminder(&pool, &second, expiry)
        .await
        .unwrap());
}

/// Exercise authentication, request validation, adapter admission, and HTTP errors.
#[tokio::test]
async fn connect_push_foreign_endpoint_returns_404_without_any_writes() {
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    use serde_json::{json, Value};
    use tower::ServiceExt;

    async fn save_request(app: &axum::Router, token: &str, body: Value) -> (StatusCode, Value) {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/puzzled.v1.PreferencesService/SaveWebPushSubscription")
                    .header("content-type", "application/json")
                    .header("authorization", format!("Bearer {token}"))
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = response.status();
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        (status, serde_json::from_slice(&bytes).unwrap())
    }

    let Some(pool) = fresh_database().await else {
        return;
    };
    let first = Uuid::now_v7();
    let second = Uuid::now_v7();
    let first_token = crate::test_support::token(&first.to_string());
    let second_token = crate::test_support::token(&second.to_string());
    let app = crate::router(crate::AppState::new(Some(pool.clone())));
    let endpoint = "https://fcm.googleapis.com/fcm/send/ownership-regression";
    let mut key = [1_u8; 65];
    key[0] = 4;
    let original_key = URL_SAFE_NO_PAD.encode(key);
    let original_auth = URL_SAFE_NO_PAD.encode([1_u8; 16]);
    let registration = json!({
        "endpoint": endpoint, "p256dh": original_key,
        "auth": original_auth, "locale": "zh-HK"
    });
    for _ in 0..2 {
        assert_eq!(
            save_request(&app, &first_token, registration.clone())
                .await
                .0,
            StatusCode::OK
        );
    }
    key[1] = 2;
    let forged = json!({
        "endpoint": endpoint, "p256dh": URL_SAFE_NO_PAD.encode(key),
        "auth": URL_SAFE_NO_PAD.encode([2_u8; 16]), "locale": "zh-TW"
    });
    for body in [
        forged.clone(),
        json!({"endpoint": endpoint, "remove": true}),
    ] {
        let (status, body) = save_request(&app, &second_token, body).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["code"], "not_found");
        assert_eq!(body["message"], "push_subscription_not_found");
        let row: (Uuid, String, String) = sqlx::query_as(
            "SELECT user_id, p256dh, auth FROM push_subscriptions WHERE endpoint = $1",
        )
        .bind(endpoint)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(row, (first, original_key.clone(), original_auth.clone()));
        let prefs: Vec<(Uuid, String)> =
            sqlx::query_as("SELECT user_id, locale FROM user_preferences ORDER BY user_id")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(prefs, [(first, "zh-HK".into())]);
    }
    // The current owner can still rotate its keys and remove its subscription.
    assert_eq!(
        save_request(&app, &first_token, forged).await.0,
        StatusCode::OK
    );
    assert_eq!(
        save_request(
            &app,
            &first_token,
            json!({"endpoint": endpoint, "remove": true})
        )
        .await
        .0,
        StatusCode::OK
    );
    let remaining: i64 = sqlx::query_scalar("SELECT count(*) FROM push_subscriptions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(remaining, 0);
    // A shared-device account switch registers a genuinely fresh endpoint.
    let mut fresh = registration;
    fresh["endpoint"] = json!("https://fcm.googleapis.com/fcm/send/fresh-subscription");
    assert_eq!(
        save_request(&app, &second_token, fresh).await.0,
        StatusCode::OK
    );
    pool.close().await;
}
