//! The immediate-supply consent, one small row per checkout started: the
//! buyer asked for access now and understood the 14-day cancellation right is
//! lost (UK consumer contracts rules for digital content). It is a record of
//! what the buyer agreed to, not a billing table: Money holds every payment.

use sqlx::PgPool;
use uuid::Uuid;

/// The statement the checkout box shows (en-US source text; the page shows a
/// translation of it). Stored with the row so the record reads on its own.
pub const IMMEDIATE_SUPPLY_STATEMENT: &str =
    "I want access now and understand I lose the 14-day cancellation right.";

pub async fn record(
    pool: &PgPool,
    user_id: &str,
    plan_id: &str,
    price_key: &str,
    locale: &str,
) -> Result<(), String> {
    let user = Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    sqlx::query(
        r#"INSERT INTO "checkout_consents" ("id", "user_id", "plan_id", "price_key", "locale", "statement")
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(Uuid::now_v7())
    .bind(user)
    .bind(plan_id)
    .bind(price_key)
    .bind(locale)
    .bind(IMMEDIATE_SUPPLY_STATEMENT)
    .execute(pool)
    .await
    .map(|_| ())
    .map_err(|e| e.to_string())
}
