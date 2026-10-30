//! First-party funnel counter: `landing`, `game_start`, `signup` and
//! `web_vitals` rows in `funnel_events`. Rows are anonymous (no user id, no IP,
//! no cookie), so the counter needs no consent and no third party. Read it with
//! plain SQL, e.g. `SELECT event, count(*) FROM funnel_events GROUP BY 1`.

use serde::Deserialize;
use sqlx::PgPool;

const METRICS: [&str; 5] = ["LCP", "CLS", "INP", "FCP", "TTFB"];
const RATINGS: [&str; 3] = ["good", "needs-improvement", "poor"];

/// One event as the browser sends it. Unknown fields are ignored.
#[derive(Debug, Deserialize, Default)]
pub struct Incoming {
    pub event: String,
    pub path: Option<String>,
    pub game_slug: Option<String>,
    pub metric: Option<String>,
    pub value: Option<f64>,
    pub rating: Option<String>,
}

/// A checked row, ready to store.
#[derive(Debug, PartialEq)]
pub struct Row {
    pub event: &'static str,
    pub path: Option<String>,
    pub game_slug: Option<String>,
    pub metric: Option<&'static str>,
    pub value: Option<f64>,
    pub rating: Option<&'static str>,
}

fn clean_path(raw: &str) -> Option<String> {
    let path = raw.split(['?', '#']).next()?;
    if !path.starts_with('/') || path.len() > 200 || !path.is_ascii() {
        return None;
    }
    let mut parts = path.trim_matches('/').split('/');
    let first = parts.next().unwrap_or_default();
    let path = if matches!(
        first,
        "en-US" | "en-GB" | "zh-HK" | "zh-CN" | "zh-TW" | "ja" | "es" | "pt-BR"
    ) {
        format!("/{}", parts.collect::<Vec<_>>().join("/"))
    } else {
        path.trim_end_matches('/').to_owned()
    };
    let path = if path.is_empty() { "/" } else { &path };
    if matches!(
        path,
        "/" | "/games"
            | "/pricing"
            | "/privacy"
            | "/terms"
            | "/support"
            | "/login"
            | "/signup"
            | "/delete-account"
    ) {
        return Some(path.to_owned());
    }
    // Never persist arbitrary account/share identifiers or user-entered paths.
    if path
        .strip_prefix("/games/")
        .is_some_and(|slug| clean_slug(slug).is_some())
    {
        return Some("/games/:slug".to_owned());
    }
    None
}

fn clean_slug(raw: &str) -> Option<String> {
    (!raw.is_empty()
        && raw.len() <= 64
        && raw
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-'))
    .then(|| raw.to_owned())
}

/// Accept only the four known events and bounded fields; anything else is None.
/// `signup` is recorded by the api itself, never accepted from a browser.
#[must_use]
pub fn validate_browser(incoming: &Incoming) -> Option<Row> {
    let event = match incoming.event.as_str() {
        "landing" => "landing",
        "share_landing" => "share_landing",
        "game_start" => "game_start",
        "web_vitals" => "web_vitals",
        _ => return None,
    };
    let path = incoming.path.as_deref().and_then(clean_path);
    let game_slug = (event == "game_start")
        .then(|| incoming.game_slug.as_deref().and_then(clean_slug))
        .flatten();
    if event == "game_start" && game_slug.is_none() {
        return None;
    }
    if event != "web_vitals" {
        return Some(Row {
            event,
            path,
            game_slug,
            metric: None,
            value: None,
            rating: None,
        });
    }
    let metric = METRICS
        .iter()
        .find(|m| Some(**m) == incoming.metric.as_deref())?;
    let value = incoming.value.filter(|v| v.is_finite() && *v >= 0.0)?;
    let rating = RATINGS
        .iter()
        .find(|r| Some(**r) == incoming.rating.as_deref())
        .copied();
    Some(Row {
        event,
        path,
        game_slug: None,
        metric: Some(metric),
        value: Some(value),
        rating,
    })
}

pub async fn insert(pool: &PgPool, row: &Row) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO "funnel_events" ("id", "event", "path", "game_slug", "metric", "value", "rating")
           VALUES ($1, $2, $3, $4, $5, $6, $7)"#,
    )
    .bind(uuid::Uuid::now_v7())
    .bind(row.event)
    .bind(&row.path)
    .bind(&row.game_slug)
    .bind(row.metric)
    .bind(row.value)
    .bind(row.rating)
    .execute(pool)
    .await
    .map_err(|e| format!("funnel event insert failed: {e}"))?;
    Ok(())
}

/// A new account. Best effort: a failure is logged by the caller, never surfaced.
pub async fn record_signup(pool: &PgPool, user_id: &str) -> Result<(), String> {
    let user_id = uuid::Uuid::parse_str(user_id).map_err(|e| e.to_string())?;
    // The receipt and anonymous event commit together; retries/concurrent calls
    // cannot inflate signup counts and a failed insert leaves the call retryable.
    sqlx::query(
        r#"WITH first_signup AS (
            INSERT INTO funnel_signup_receipts (user_id) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM synthetic_fixtures WHERE user_id=$1)
            ON CONFLICT DO NOTHING RETURNING user_id
        ) INSERT INTO funnel_events (id, event) SELECT $2, 'signup' FROM first_signup"#,
    )
    .bind(user_id)
    .bind(uuid::Uuid::now_v7())
    .execute(pool)
    .await
    .map_err(|e| format!("funnel signup insert failed: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn incoming(json: &str) -> Incoming {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn browsers_cannot_send_signup_or_unknown_events() {
        assert!(validate_browser(&incoming(r#"{"event":"signup"}"#)).is_none());
        assert!(validate_browser(&incoming(r#"{"event":"purchase"}"#)).is_none());
    }

    #[test]
    fn landing_keeps_only_the_path_without_query() {
        let row =
            validate_browser(&incoming(r#"{"event":"landing","path":"/pricing?x=1#a"}"#)).unwrap();
        assert_eq!(row.path.as_deref(), Some("/pricing"));
        let row = validate_browser(&incoming(r#"{"event":"landing","path":"http://x"}"#)).unwrap();
        assert_eq!(row.path, None);
    }

    #[test]
    fn private_paths_are_not_retained() {
        for path in [
            "/account/alice",
            "/share/private-id",
            "/login/alice@example.com",
        ] {
            assert_eq!(clean_path(path), None);
        }
        assert_eq!(
            clean_path("/zh-HK/pricing?token=secret"),
            Some("/pricing".to_owned())
        );
        assert_eq!(clean_path("/games/sudoku"), Some("/games/:slug".to_owned()));
    }

    #[test]
    fn game_start_needs_a_clean_slug() {
        assert!(validate_browser(&incoming(r#"{"event":"game_start"}"#)).is_none());
        assert!(
            validate_browser(&incoming(r#"{"event":"game_start","game_slug":"A b"}"#)).is_none()
        );
        assert!(
            validate_browser(&incoming(
                r#"{"event":"game_start","game_slug":"word-guess"}"#
            ))
            .is_some()
        );
    }

    #[test]
    fn web_vitals_need_a_known_metric_and_a_finite_value() {
        let ok = r#"{"event":"web_vitals","metric":"LCP","value":1200.5,"rating":"good"}"#;
        assert_eq!(validate_browser(&incoming(ok)).unwrap().metric, Some("LCP"));
        assert!(
            validate_browser(&incoming(
                r#"{"event":"web_vitals","metric":"FOO","value":1}"#
            ))
            .is_none()
        );
        assert!(
            validate_browser(&incoming(
                r#"{"event":"web_vitals","metric":"CLS","value":-1}"#
            ))
            .is_none()
        );
    }
}
