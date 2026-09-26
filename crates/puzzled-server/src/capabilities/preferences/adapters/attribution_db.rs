//! First-touch campaign tags per account (`account_attribution`).

use chrono::{DateTime, Utc};
use puzzled_core::attribution::Attribution;
use sqlx::{PgPool, Row};
use uuid::Uuid;

fn uid(user_id: &str) -> Result<Uuid, String> {
    Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))
}

/// Store the account's first-touch tags; an existing row is kept (first touch
/// wins). Returns true when a row was written.
pub async fn record_attribution(
    pool: &PgPool,
    user_id: &str,
    tags: &Attribution,
) -> Result<bool, String> {
    let landed_at = tags
        .landed_at_ms
        .and_then(DateTime::<Utc>::from_timestamp_millis)
        .map(|at| at.naive_utc());
    let result = sqlx::query(
        r#"INSERT INTO "account_attribution"
             ("user_id", "utm_source", "utm_medium", "utm_campaign", "utm_term",
              "utm_content", "ref", "landing_path", "landed_at")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT ("user_id") DO NOTHING"#,
    )
    .bind(uid(user_id)?)
    .bind(&tags.source)
    .bind(&tags.medium)
    .bind(&tags.campaign)
    .bind(&tags.term)
    .bind(&tags.content)
    .bind(&tags.referral)
    .bind(&tags.landing_path)
    .bind(landed_at)
    .execute(pool)
    .await
    .map_err(|e| format!("attribution write failed: {e}"))?;
    Ok(result.rows_affected() == 1)
}

/// The account's stored first-touch tags, if any.
pub async fn attribution_for_user(
    pool: &PgPool,
    user_id: &str,
) -> Result<Option<Attribution>, String> {
    let row = sqlx::query(
        r#"SELECT "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
                  "ref", "landing_path"
           FROM "account_attribution" WHERE "user_id" = $1"#,
    )
    .bind(uid(user_id)?)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("attribution read failed: {e}"))?;
    let Some(row) = row else {
        return Ok(None);
    };
    let get = |name: &str| row.try_get::<Option<String>, _>(name).ok().flatten();
    Ok(Some(Attribution {
        source: get("utm_source"),
        medium: get("utm_medium"),
        campaign: get("utm_campaign"),
        term: get("utm_term"),
        content: get("utm_content"),
        referral: get("ref"),
        landing_path: get("landing_path"),
        landed_at_ms: None,
    }))
}
