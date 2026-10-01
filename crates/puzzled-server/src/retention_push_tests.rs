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
    web_push::remove(&pool, second, endpoint).await.unwrap();
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM push_subscriptions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    // The same browser signing into a different account changes its owner.
    web_push::save(
        &pool,
        second,
        endpoint,
        "rotated-public-key",
        "rotated-auth-key",
        "zh-TW",
    )
    .await
    .unwrap();
    delete_account_data(&pool, &first.to_string())
        .await
        .unwrap();
    let owner: Uuid = sqlx::query_scalar("SELECT user_id FROM push_subscriptions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(owner, second);
    web_push::remove(&pool, second, endpoint).await.unwrap();
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
    let guest = format!("guest_{}", Uuid::now_v7());
    let account = Uuid::now_v7().to_string();
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
        adopt_guest_sessions(&pool, &account, &guest).await.unwrap(),
        2
    );
    assert_eq!(
        adopt_guest_sessions(&pool, &account, &guest).await.unwrap(),
        0
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
