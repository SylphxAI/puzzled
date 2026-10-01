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
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| "consent database unavailable".to_string())?;
    record_in_transaction(&mut tx, user, plan_id, price_key, locale).await?;
    tx.commit()
        .await
        .map_err(|_| "consent commit failed".to_string())
}

/// Checkout admission holds this same transaction across its external effect.
/// Do not write through the pool while holding the player advisory lock.
pub async fn record_in_transaction(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user: Uuid,
    plan_id: &str,
    price_key: &str,
    locale: &str,
) -> Result<(), String> {
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
    .execute(&mut **tx)
    .await
    .map(|_| ())
    .map_err(|_| "consent write failed".to_string())
}

/// One bounded retention page, shared by the existing Jobs/startup owner.
/// Linked consent is never purged here. Concurrent replicas skip locked rows.
/// Expiry is a UTC calendar timestamp, independent of the connection timezone.
pub(crate) const PURGE_EXPIRED_UNLINKED: &str = r#"WITH due AS (
            SELECT id FROM checkout_consents
            WHERE user_id IS NULL
              AND retention_expires_at <= (statement_timestamp() AT TIME ZONE 'UTC')
            ORDER BY retention_expires_at, id
            LIMIT 256 FOR UPDATE SKIP LOCKED
        ) DELETE FROM checkout_consents c USING due WHERE c.id = due.id"#;

pub async fn purge_expired_unlinked(pool: &PgPool) -> Result<u64, String> {
    sqlx::query(PURGE_EXPIRED_UNLINKED)
        .execute(pool)
        .await
        .map(|result| result.rows_affected())
        .map_err(|_| "checkout consent retention failed".to_string())
}
