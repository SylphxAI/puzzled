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
        && PUSH_SERVICE_SUFFIXES.iter().any(|suffix| {
            host.strip_suffix(suffix)
                .is_some_and(|label| !label.is_empty())
        })
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
        "ja" => (
            "今日のパズルの準備ができました",
            "今日のパズルがあなたを待っています。数分で遊べます。",
            "/ja",
        ),
        "es" => (
            "Tu puzle diario está listo",
            "El puzle de hoy te está esperando. Solo te llevará unos minutos.",
            "/es",
        ),
        "pt-BR" => (
            "Seu quebra-cabeça diário está pronto",
            "O quebra-cabeça de hoje está esperando por você. Leva só alguns minutos.",
            "/pt-BR",
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
pub async fn send_daily(pool: &PgPool, player: &str) -> Result<(), String> {
    let player = Uuid::parse_str(player).map_err(|_| "invalid player".to_string())?;
    let rows: Vec<(String, String, String)> =
        sqlx::query_as("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1")
            .bind(player)
            .fetch_all(pool)
            .await
            .map_err(|_| "push subscription read failed".to_string())?;
    if rows.is_empty() {
        return Ok(());
    }
    let locale: Option<String> = sqlx::query_scalar(
        "SELECT COALESCE(locale, 'en-US') FROM user_preferences WHERE user_id = $1",
    )
    .bind(player)
    .fetch_optional(pool)
    .await
    .map_err(|_| "push locale read failed".to_string())?;
    let payload = reminder_payload(locale.as_deref().unwrap_or("en-US")).to_string();
    let sender = DirectVapidSender::from_env()?;
    let subscriptions = rows
        .into_iter()
        .map(|(endpoint, p256dh, auth)| SubscriptionInfo::new(endpoint, p256dh, auth))
        .collect();
    deliver_subscriptions(pool, player, subscriptions, &payload, &sender).await
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
    let mut failed = false;
    let mut delivered = false;
    for subscription in subscriptions {
        match sender.send(&subscription, payload).await {
            Ok(PushDelivery::Delivered) => delivered = true,
            Ok(PushDelivery::Expired) => {
                // Continue after pruning errors: a later browser may receive the
                // reminder, in which case the player-level claim must stay held.
                if remove(pool, player, &subscription.endpoint).await.is_err() {
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
        for locale in [
            "en-US", "en-GB", "zh-HK", "zh-TW", "zh-CN", "ja", "es", "pt-BR",
        ] {
            let payload = reminder_payload(locale);
            assert!(!payload["body"].as_str().unwrap().is_empty());
        }
    }
}
