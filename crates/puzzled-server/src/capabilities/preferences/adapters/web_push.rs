//! Browser subscriptions are player-scoped; delivery uses RFC 8291/8292 directly.
use super::web_push_sender::{DirectVapidSender, PushDelivery, PushSender};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sqlx::PgPool;
use uuid::Uuid;
use web_push::SubscriptionInfo;

// The browser's endpoint is untrusted. Only public browser push services may
// receive requests; redirects are disabled too (no internal-network fetches).
pub fn valid_endpoint(endpoint: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(endpoint) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default();
    url.scheme() == "https"
        && url.port().is_none_or(|port| port == 443)
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && endpoint.len() <= 4096
        && PUSH_SERVICE_SUFFIXES
            .iter()
            .any(|suffix| host.strip_suffix(suffix).is_some_and(|label| !label.is_empty()))
}

// Browser push services publish many regional hosts (Chrome now hands out
// hosts such as jmt17.google.com), so match by domain suffix on a label
// boundary. IP literals never end in these suffixes.
const PUSH_SERVICE_SUFFIXES: [&str; 5] = [
    ".googleapis.com",
    ".google.com",
    ".push.services.mozilla.com",
    ".push.apple.com",
    ".notify.windows.com",
];

pub fn valid_keys(p256dh: &str, auth: &str) -> bool {
    URL_SAFE_NO_PAD
        .decode(p256dh)
        .is_ok_and(|key| key.len() == 65 && key[0] == 4)
        && URL_SAFE_NO_PAD
            .decode(auth)
            .is_ok_and(|key| key.len() == 16)
}

pub async fn save(
    pool: &PgPool,
    player: Uuid,
    endpoint: &str,
    p256dh: &str,
    auth: &str,
    locale: &str,
) -> Result<(), sqlx::Error> {
    // Endpoint knowledge and shaped keys are not proof of browser possession.
    // Only its existing owner may rotate keys; account switches must obtain a
    // fresh browser subscription after explicitly unsubscribing the old one.
    let mut transaction = pool.begin().await?;
    let saved = sqlx::query("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth WHERE push_subscriptions.user_id = EXCLUDED.user_id")
        .bind(Uuid::now_v7()).bind(player).bind(endpoint).bind(p256dh).bind(auth).execute(&mut *transaction).await?;
    if saved.rows_affected() == 0 {
        transaction.rollback().await?;
        return Err(sqlx::Error::RowNotFound);
    }
    sqlx::query("INSERT INTO user_preferences (user_id, locale) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET locale = EXCLUDED.locale")
        .bind(player).bind(locale).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn remove(pool: &PgPool, player: Uuid, endpoint: &str) -> Result<(), sqlx::Error> {
    let removed =
        sqlx::query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2")
            .bind(player)
            .bind(endpoint)
            .execute(pool)
            .await?;
    if removed.rows_affected() == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    Ok(())
}

pub fn reminder_payload(locale: &str) -> serde_json::Value {
    let (title, body, url) = match locale {
        "zh-HK" => (
            "每日謎題準備好喇",
            "今日嘅謎題等緊你，幾分鐘就玩到。",
            "/zh-HK",
        ),
        "zh-TW" => (
            "每日謎題準備好了",
            "今天的謎題等著你，只需幾分鐘。",
            "/zh-TW",
        ),
        "zh-CN" => (
            "每日谜题准备好了",
            "今天的谜题等着你，只需几分钟。",
            "/zh-CN",
        ),
        "en-GB" => (
            "Your daily puzzle is ready",
            "Today's puzzle is waiting. It only takes a few minutes.",
            "/en-GB",
        ),
        _ => (
            "Your daily puzzle is ready",
            "Today's puzzle is waiting. It only takes a few minutes.",
            "/",
        ),
    };
    serde_json::json!({"title": title, "body": body, "url": url, "tag": "daily-puzzle"})
}

/// Send to every active browser. Expired endpoints are removed; transient
/// failures release the daily claim only if no browser received the reminder.
pub async fn send_daily(
    pool: &PgPool,
    player: &str,
    deadline: tokio::time::Instant,
) -> Result<(), String> {
    let player = Uuid::parse_str(player).map_err(|_| "invalid player".to_string())?;
    let rows: Vec<(String, String, String)> = tokio::time::timeout_at(
        deadline,
        sqlx::query_as("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1")
            .bind(player)
            .fetch_all(pool),
    )
    .await
    .map_err(|_| "push delivery deadline reached".to_string())?
    .map_err(|_| "push subscription read failed".to_string())?;
    if rows.is_empty() {
        return Ok(());
    }
    let locale: Option<String> = tokio::time::timeout_at(
        deadline,
        sqlx::query_scalar(
            "SELECT COALESCE(locale, 'en-US') FROM user_preferences WHERE user_id = $1",
        )
        .bind(player)
        .fetch_optional(pool),
    )
    .await
    .map_err(|_| "push delivery deadline reached".to_string())?
    .map_err(|_| "push locale read failed".to_string())?;
    let payload = reminder_payload(locale.as_deref().unwrap_or("en-US")).to_string();
    let sender = DirectVapidSender::from_env()?;
    let subscriptions = rows
        .into_iter()
        .map(|(endpoint, p256dh, auth)| SubscriptionInfo::new(endpoint, p256dh, auth))
        .collect();
    deliver_subscriptions_until(
        pool,
        player,
        subscriptions,
        &payload,
        &sender,
        Some(deadline),
    )
    .await
}

/// Subscription lifecycle stays above the transport adapter. A future Notify
/// sender returns the same delivery outcomes; the reminder job is unchanged.
pub async fn deliver_subscriptions(
    pool: &PgPool,
    player: Uuid,
    subscriptions: Vec<SubscriptionInfo>,
    payload: &str,
    sender: &impl PushSender,
) -> Result<(), String> {
    deliver_subscriptions_until(pool, player, subscriptions, payload, sender, None).await
}

/// Deadline lives inside the accumulator: cancelling a stalled endpoint must
/// not discard successes already observed on other browsers. The job reserves
/// acknowledgement time before supplying this lease-relative deadline.
pub async fn deliver_subscriptions_until(
    pool: &PgPool,
    player: Uuid,
    subscriptions: Vec<SubscriptionInfo>,
    payload: &str,
    sender: &impl PushSender,
    deadline: Option<tokio::time::Instant>,
) -> Result<(), String> {
    deliver_subscriptions_with_clock(
        pool,
        player,
        subscriptions,
        payload,
        sender,
        deadline,
        tokio::time::Instant::now,
    )
    .await
}

async fn deliver_subscriptions_with_clock(
    pool: &PgPool,
    player: Uuid,
    subscriptions: Vec<SubscriptionInfo>,
    payload: &str,
    sender: &impl PushSender,
    deadline: Option<tokio::time::Instant>,
    mut now: impl FnMut() -> tokio::time::Instant,
) -> Result<(), String> {
    let mut failed = false;
    let mut delivered = false;
    for subscription in subscriptions {
        if deadline.is_some_and(|deadline| now() >= deadline) {
            failed = true;
            break;
        }
        let outcome = match deadline {
            Some(deadline) => {
                tokio::time::timeout_at(deadline, sender.send(&subscription, payload))
                    .await
                    .unwrap_or_else(|_| Err("push delivery deadline reached".to_string()))
            }
            None => sender.send(&subscription, payload).await,
        };
        match outcome {
            Ok(PushDelivery::Delivered) => delivered = true,
            Ok(PushDelivery::Expired) => {
                // Continue after pruning errors: a later browser may receive the
                // reminder, in which case the player-level claim must stay held.
                let removed = match deadline {
                    Some(deadline) => tokio::time::timeout_at(
                        deadline,
                        remove(pool, player, &subscription.endpoint),
                    )
                    .await
                    .is_ok_and(|result| result.is_ok()),
                    None => remove(pool, player, &subscription.endpoint).await.is_ok(),
                };
                if !removed {
                    failed = true;
                }
            }
            Err(_) => failed = true,
        }
    }
    // A claim is per player, not per endpoint. Retrying after partial success
    // would notify the successful browser again during the grace window.
    if failed && !delivered {
        Err("web push delivery failed".to_string())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoints_cannot_fetch_internal_services() {
        for url in [
            "http://fcm.googleapis.com/x",
            "https://127.0.0.1/x",
            "https://fcm.googleapis.com.evil.test/x",
            "https://user@fcm.googleapis.com/x",
            "https://fcm.googleapis.com:8443/x",
        ] {
            assert!(!valid_endpoint(url));
        }
        for url in [
            "https://fcm.googleapis.com/fcm/send/test",
            "https://updates.push.services.mozilla.com/wpush/v2/test",
            "https://web.push.apple.com/test",
            "https://jmt17.google.com/fcm/send/test",
            "https://wns2-par02p.notify.windows.com/w/?token=x",
            "https://api.push.apple.com/3/device/x",
        ] {
            assert!(valid_endpoint(url), "{url}");
        }
        for url in [
            "https://google.com/x",
            "https://evilgoogle.com/x",
            "https://fcm.googleapis.com.evil.com/x",
            "https://evil.com/.google.com",
            "http://jmt17.google.com/x",
            "https://[::1]/x",
            "https://127.0.0.1/x",
            "https://jmt17.google.com:8443/x",
            "https://u:p@jmt17.google.com/x",
        ] {
            assert!(!valid_endpoint(url), "{url}");
        }
    }
    #[test]
    fn validates_keys_and_all_locales() {
        assert!(!valid_keys("", ""));
        for locale in ["en-US", "en-GB", "zh-HK", "zh-TW", "zh-CN"] {
            let payload = reminder_payload(locale);
            assert!(!payload["body"].as_str().unwrap().is_empty());
        }
    }
    async fn slow_endpoint_budget(any_success: bool) {
        use std::sync::{
            atomic::{AtomicU64, AtomicUsize, Ordering},
            Arc,
        };
        struct SlowSender {
            elapsed: Arc<AtomicU64>,
            attempts: AtomicUsize,
            any_success: bool,
        }
        impl PushSender for SlowSender {
            async fn send<'a>(
                &'a self,
                _subscription: &'a SubscriptionInfo,
                _payload: &'a str,
            ) -> Result<PushDelivery, String> {
                let attempt = self.attempts.fetch_add(1, Ordering::SeqCst);
                // Deterministically model the existing ten-second endpoint limit.
                self.elapsed.fetch_add(10, Ordering::SeqCst);
                if self.any_success && attempt == 0 {
                    Ok(PushDelivery::Delivered)
                } else {
                    Err("slow endpoint failed".to_string())
                }
            }
        }
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://test@127.0.0.1:59473/test")
            .unwrap();
        let elapsed = Arc::new(AtomicU64::new(0));
        let sender = SlowSender {
            elapsed: elapsed.clone(),
            attempts: AtomicUsize::new(0),
            any_success,
        };
        let base = tokio::time::Instant::now();
        let deadline = base + std::time::Duration::from_secs(290);
        let subscriptions = (0..100)
            .map(|i| {
                SubscriptionInfo::new(
                    format!("https://fcm.googleapis.com/fcm/send/{i}"),
                    "public-key".to_string(),
                    "auth-key".to_string(),
                )
            })
            .collect();
        let result = deliver_subscriptions_with_clock(
            &pool,
            Uuid::now_v7(),
            subscriptions,
            "{}",
            &sender,
            Some(deadline),
            || base + std::time::Duration::from_secs(elapsed.load(Ordering::SeqCst)),
        )
        .await;
        assert_eq!(sender.attempts.load(Ordering::SeqCst), 29);
        assert_eq!(elapsed.load(Ordering::SeqCst), 290);
        assert_eq!(result.is_ok(), any_success);
        // Ten seconds remain for the fenced database acknowledgement. No 30th
        // endpoint starts; any success before exhaustion stays accumulated.
    }

    #[tokio::test]
    async fn slow_endpoints_stop_with_ack_budget_and_keep_partial_success() {
        slow_endpoint_budget(true).await;
    }

    #[tokio::test]
    async fn slow_endpoints_with_no_success_release_instead_of_marking_delivery() {
        slow_endpoint_budget(false).await;
    }

    #[tokio::test]
    async fn stalled_endpoint_deadline_does_not_cancel_previous_success() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        struct StalledSender(AtomicUsize);
        impl PushSender for StalledSender {
            async fn send<'a>(
                &'a self,
                _subscription: &'a SubscriptionInfo,
                _payload: &'a str,
            ) -> Result<PushDelivery, String> {
                if self.0.fetch_add(1, Ordering::SeqCst) == 0 {
                    Ok(PushDelivery::Delivered)
                } else {
                    std::future::pending().await
                }
            }
        }
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://test@127.0.0.1:59473/test")
            .unwrap();
        let sender = StalledSender(AtomicUsize::new(0));
        let subscriptions = (0..3)
            .map(|i| {
                SubscriptionInfo::new(
                    format!("https://fcm.googleapis.com/fcm/send/{i}"),
                    "public-key".to_string(),
                    "auth-key".to_string(),
                )
            })
            .collect();
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(20);
        assert!(deliver_subscriptions_until(
            &pool,
            Uuid::now_v7(),
            subscriptions,
            "{}",
            &sender,
            Some(deadline)
        )
        .await
        .is_ok());
        assert_eq!(sender.0.load(Ordering::SeqCst), 2);
    }
}
