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

#[tokio::test]
async fn cancelled_worker_and_reconstructed_worker_recover_the_unacknowledged_batch() {
    use crate::bootstrap::connect_jobs::send_due_daily_reminders_with;
    use crate::capabilities::jobs::adapters::jobs_db::REMINDER_LEASE_SECONDS;
    let Some(pool) = fresh_database().await else {
        return;
    };
    for _ in 0..3 {
        sqlx::query("INSERT INTO notification_preferences (user_id, push_enabled, push_daily_reminder, daily_reminder_time, timezone) VALUES ($1, true, true, '08:00', 'UTC')")
            .bind(Uuid::now_v7()).execute(&pool).await.unwrap();
    }
    let now = "2026-10-01T08:00:00Z".parse().unwrap();
    let (entered, started) = tokio::sync::oneshot::channel();
    let worker_pool = pool.clone();
    let worker = tokio::spawn(async move {
        let mut entered = Some(entered);
        let mut attempts = 0;
        send_due_daily_reminders_with(&worker_pool, now, |_| {
            attempts += 1;
            let first = attempts == 1;
            if !first {
                if let Some(entered) = entered.take() {
                    entered.send(()).unwrap();
                }
            }
            async move {
                if first {
                    Ok(())
                } else {
                    std::future::pending::<Result<(), String>>().await
                }
            }
        })
        .await
    });
    started.await.unwrap();
    worker.abort();
    assert!(worker.await.unwrap_err().is_cancelled());
    let delivered: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM notification_preferences WHERE last_daily_reminder_on IS NOT NULL",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(delivered, 1);
    // Reconstruct the executor with no in-memory claim state. It cannot steal
    // live leases; expiry recovers only the two not acknowledged as delivered.
    assert_eq!(
        send_due_daily_reminders_with(&pool, now, |_| async { Ok(()) })
            .await
            .unwrap(),
        0
    );
    let retried = now + chrono::Duration::seconds(REMINDER_LEASE_SECONDS);
    assert_eq!(
        send_due_daily_reminders_with(&pool, retried, |_| async { Ok(()) })
            .await
            .unwrap(),
        2
    );
    assert_eq!(
        send_due_daily_reminders_with(&pool, retried, |_| async { Ok(()) })
            .await
            .unwrap(),
        0
    );
}

#[tokio::test]
async fn delivery_before_ack_crash_explicitly_allows_at_least_once_retry() {
    use crate::capabilities::jobs::adapters::jobs_db::{
        acknowledge_daily_reminder, claim_due_daily_reminders, REMINDER_LEASE_SECONDS,
    };
    let Some(pool) = fresh_database().await else {
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

#[tokio::test]
async fn successful_tick_drains_more_than_one_bounded_batch() {
    use crate::bootstrap::connect_jobs::send_due_daily_reminders_with;
    use crate::capabilities::jobs::adapters::jobs_db::REMINDER_CLAIM_BATCH;
    let Some(pool) = fresh_database().await else {
        return;
    };
    for _ in 0..(REMINDER_CLAIM_BATCH + 1) {
        sqlx::query("INSERT INTO notification_preferences (user_id, push_enabled, push_daily_reminder, daily_reminder_time, timezone) VALUES ($1, true, true, '08:00', 'UTC')")
            .bind(Uuid::now_v7()).execute(&pool).await.unwrap();
    }
    let now = "2026-10-01T08:00:00Z".parse().unwrap();
    assert_eq!(
        send_due_daily_reminders_with(&pool, now, |_| async { Ok(()) })
            .await
            .unwrap(),
        (REMINDER_CLAIM_BATCH + 1) as u32
    );
    assert_eq!(
        send_due_daily_reminders_with(&pool, now, |_| async { Ok(()) })
            .await
            .unwrap(),
        0
    );
}
