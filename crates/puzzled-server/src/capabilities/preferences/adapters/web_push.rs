//! Browser subscriptions are player-scoped; delivery uses RFC 8291/8292 directly.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sqlx::PgPool;
use uuid::Uuid;
use web_push::{ContentEncoding, SubscriptionInfo, VapidSignatureBuilder, WebPushMessageBuilder};

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
        && (host == "fcm.googleapis.com"
            || host == "updates.push.services.mozilla.com"
            || host == "web.push.apple.com"
            || host.ends_with(".notify.windows.com"))
}

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
    // An endpoint is owned by this browser. Registering under a new signed-in
    // account moves it rather than notifying the previous account on a shared device.
    let mut transaction = pool.begin().await?;
    sqlx::query("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth")
        .bind(Uuid::now_v7()).bind(player).bind(endpoint).bind(p256dh).bind(auth).execute(&mut *transaction).await?;
    sqlx::query("INSERT INTO user_preferences (user_id, locale) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET locale = EXCLUDED.locale")
        .bind(player).bind(locale).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(())
}

pub async fn remove(pool: &PgPool, player: Uuid, endpoint: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2")
        .bind(player)
        .bind(endpoint)
        .execute(pool)
        .await?;
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
/// failures release the existing daily-reminder claim so the next tick retries.
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
    let key = std::env::var("VAPID_PRIVATE_KEY")
        .map_err(|_| "VAPID_PRIVATE_KEY unconfigured".to_string())?;
    let subject =
        std::env::var("VAPID_SUBJECT").map_err(|_| "VAPID_SUBJECT unconfigured".to_string())?;
    let locale: Option<String> = sqlx::query_scalar(
        "SELECT COALESCE(locale, 'en-US') FROM user_preferences WHERE user_id = $1",
    )
    .bind(player)
    .fetch_optional(pool)
    .await
    .map_err(|_| "push locale read failed".to_string())?;
    let payload = reminder_payload(locale.as_deref().unwrap_or("en-US")).to_string();
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|_| "push client failed".to_string())?;
    let mut failed = false;
    for (endpoint, p256dh, auth) in rows {
        if !valid_endpoint(&endpoint) {
            failed = true;
            continue;
        }
        let subscription = SubscriptionInfo::new(endpoint.clone(), p256dh, auth);
        let mut signature = VapidSignatureBuilder::from_base64(&key, &subscription)
            .map_err(|_| "invalid VAPID key".to_string())?;
        signature.add_claim("sub", subject.clone());
        let signature = signature
            .build()
            .map_err(|_| "VAPID signing failed".to_string())?;
        let mut builder = WebPushMessageBuilder::new(&subscription);
        builder.set_vapid_signature(signature);
        builder.set_payload(ContentEncoding::Aes128Gcm, payload.as_bytes());
        builder.set_ttl(3600);
        let message = builder
            .build()
            .map_err(|_| "push encryption failed".to_string())?;
        let encrypted = message.payload.ok_or("push payload missing")?;
        let mut request = client
            .post(&endpoint)
            .header("TTL", "3600")
            .header("Content-Type", "application/octet-stream")
            .header("Content-Encoding", "aes128gcm");
        for (name, value) in encrypted.crypto_headers {
            request = request.header(name, value);
        }
        match request.body(encrypted.content).send().await {
            Ok(response) if response.status().is_success() => {}
            Ok(response) if matches!(response.status().as_u16(), 404 | 410) => {
                remove(pool, player, &endpoint)
                    .await
                    .map_err(|_| "expired push removal failed".to_string())?;
            }
            _ => failed = true,
        }
    }
    if failed {
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
        ] {
            assert!(valid_endpoint(url));
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
}
