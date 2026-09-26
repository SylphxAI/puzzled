//! Puzzled Plus SQL: customers, subscription read-backs, the money ledger and
//! family plans. Timestamps are stored as UTC `timestamp`.

use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::stripe::StripeSubscription;

/// A stored subscription row.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscriptionRow {
    pub stripe_subscription_id: String,
    pub plan_id: String,
    pub status: String,
    pub current_period_end_ms: i64,
    pub cancel_at_period_end: bool,
    pub started_at_ms: i64,
}

fn uid(user_id: &str) -> Result<Uuid, String> {
    Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))
}

fn naive(secs: i64) -> NaiveDateTime {
    DateTime::<Utc>::from_timestamp(secs, 0)
        .unwrap_or_default()
        .naive_utc()
}

fn ms(at: NaiveDateTime) -> i64 {
    at.and_utc().timestamp_millis()
}

pub async fn customer_for_user(pool: &PgPool, user_id: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, String>(
        r#"SELECT "stripe_customer_id" FROM "billing_customers" WHERE "user_id" = $1"#,
    )
    .bind(uid(user_id)?)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("billing customer read failed: {e}"))
}

pub async fn user_for_customer(pool: &PgPool, customer: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Uuid>(
        r#"SELECT "user_id" FROM "billing_customers" WHERE "stripe_customer_id" = $1"#,
    )
    .bind(customer)
    .fetch_optional(pool)
    .await
    .map(|found| found.map(|id| id.to_string()))
    .map_err(|e| format!("billing customer read failed: {e}"))
}

/// Record the account's Stripe customer; the first writer wins.
pub async fn insert_customer(
    pool: &PgPool,
    user_id: &str,
    customer: &str,
) -> Result<String, String> {
    sqlx::query(
        r#"INSERT INTO "billing_customers" ("user_id", "stripe_customer_id") VALUES ($1, $2)
           ON CONFLICT ("user_id") DO NOTHING"#,
    )
    .bind(uid(user_id)?)
    .bind(customer)
    .execute(pool)
    .await
    .map_err(|e| format!("billing customer write failed: {e}"))?;
    customer_for_user(pool, user_id)
        .await?
        .ok_or_else(|| "billing customer missing after write".to_string())
}

/// Store the read-back state of one subscription.
pub async fn upsert_subscription(
    pool: &PgPool,
    user_id: Option<&str>,
    sub: &StripeSubscription,
) -> Result<(), String> {
    let Some(plan_id) = sub.plan_id else {
        // Not a Puzzled Plus price: nothing here grants access from it.
        return Ok(());
    };
    let user = user_id.map(uid).transpose()?;
    sqlx::query(
        r#"INSERT INTO "billing_subscriptions"
             ("stripe_subscription_id", "user_id", "stripe_customer_id", "plan_id", "status",
              "current_period_end", "cancel_at_period_end", "started_at", "updated_at",
              "attribution")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
           ON CONFLICT ("stripe_subscription_id") DO UPDATE SET
             "user_id" = COALESCE("billing_subscriptions"."user_id", EXCLUDED."user_id"),
             "plan_id" = EXCLUDED."plan_id",
             "status" = EXCLUDED."status",
             "current_period_end" = EXCLUDED."current_period_end",
             "cancel_at_period_end" = EXCLUDED."cancel_at_period_end",
             "attribution" = COALESCE("billing_subscriptions"."attribution", EXCLUDED."attribution"),
             "updated_at" = now()"#,
    )
    .bind(&sub.id)
    .bind(user)
    .bind(&sub.customer)
    .bind(plan_id)
    .bind(&sub.status)
    .bind(naive(sub.current_period_end))
    .bind(sub.cancel_at_period_end)
    .bind(naive(sub.start_date))
    .bind(&sub.attribution)
    .execute(pool)
    .await
    .map_err(|e| format!("billing subscription write failed: {e}"))?;
    Ok(())
}

fn row_to_subscription(row: &sqlx::postgres::PgRow) -> Result<SubscriptionRow, sqlx::Error> {
    Ok(SubscriptionRow {
        stripe_subscription_id: row.try_get("stripe_subscription_id")?,
        plan_id: row.try_get("plan_id")?,
        status: row.try_get("status")?,
        current_period_end_ms: ms(row.try_get("current_period_end")?),
        cancel_at_period_end: row.try_get("cancel_at_period_end")?,
        started_at_ms: ms(row.try_get("started_at")?),
    })
}

/// Every subscription the account has held, oldest first.
pub async fn subscriptions_for_user(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<SubscriptionRow>, String> {
    let rows = sqlx::query(
        r#"SELECT "stripe_subscription_id", "plan_id", "status", "current_period_end",
                  "cancel_at_period_end", "started_at"
           FROM "billing_subscriptions" WHERE "user_id" = $1
           ORDER BY "started_at" ASC, "stripe_subscription_id" ASC"#,
    )
    .bind(uid(user_id)?)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("billing subscription read failed: {e}"))?;
    rows.iter()
        .map(row_to_subscription)
        .collect::<Result<_, _>>()
        .map_err(|e| format!("billing subscription decode failed: {e}"))
}

/// Append one money fact; a repeated source id is a no-op.
#[allow(clippy::too_many_arguments)]
pub async fn append_ledger(
    pool: &PgPool,
    source_id: &str,
    kind: &str,
    user_id: Option<&str>,
    customer: &str,
    subscription: Option<&str>,
    currency: &str,
    amount_minor: i64,
    occurred_at_secs: i64,
) -> Result<bool, String> {
    let user = user_id.map(uid).transpose()?;
    let result = sqlx::query(
        r#"INSERT INTO "billing_ledger"
             ("source_id", "kind", "user_id", "stripe_customer_id", "stripe_subscription_id",
              "currency", "amount_minor", "occurred_at")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT ("source_id") DO NOTHING"#,
    )
    .bind(source_id)
    .bind(kind)
    .bind(user)
    .bind(customer)
    .bind(subscription)
    .bind(currency)
    .bind(amount_minor)
    .bind(naive(occurred_at_secs))
    .execute(pool)
    .await
    .map_err(|e| format!("billing ledger write failed: {e}"))?;
    Ok(result.rows_affected() == 1)
}

/// Record a received webhook event (audit trail); repeats are ignored.
pub async fn record_webhook_event(
    pool: &PgPool,
    event_id: &str,
    event_type: &str,
    created_secs: i64,
    resource_id: Option<&str>,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO "webhook_events" ("event_id", "event_type", "event_created_at", "resource_id")
           VALUES ($1, $2, $3, $4) ON CONFLICT ("event_id") DO NOTHING"#,
    )
    .bind(event_id)
    .bind(event_type)
    .bind(naive(created_secs))
    .bind(resource_id)
    .execute(pool)
    .await
    .map_err(|e| format!("webhook event write failed: {e}"))?;
    Ok(())
}

// ---- Family plans ----------------------------------------------------------

/// The owner of the family the account belongs to, as a member.
pub async fn family_owner_of(pool: &PgPool, member: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Uuid>(
        r#"SELECT "owner_user_id" FROM "family_members" WHERE "member_user_id" = $1"#,
    )
    .bind(uid(member)?)
    .fetch_optional(pool)
    .await
    .map(|found| found.map(|id| id.to_string()))
    .map_err(|e| format!("family read failed: {e}"))
}

pub async fn family_invite_code(pool: &PgPool, owner: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, String>(
        r#"SELECT "invite_code" FROM "family_groups" WHERE "owner_user_id" = $1"#,
    )
    .bind(uid(owner)?)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("family read failed: {e}"))
}

pub async fn family_owner_by_code(pool: &PgPool, code: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Uuid>(
        r#"SELECT "owner_user_id" FROM "family_groups" WHERE "invite_code" = $1"#,
    )
    .bind(code)
    .fetch_optional(pool)
    .await
    .map(|found| found.map(|id| id.to_string()))
    .map_err(|e| format!("family read failed: {e}"))
}

/// Create the owner's family group, or replace its invite code.
pub async fn set_family_invite_code(pool: &PgPool, owner: &str, code: &str) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO "family_groups" ("owner_user_id", "invite_code") VALUES ($1, $2)
           ON CONFLICT ("owner_user_id") DO UPDATE SET "invite_code" = EXCLUDED."invite_code""#,
    )
    .bind(uid(owner)?)
    .bind(code)
    .execute(pool)
    .await
    .map_err(|e| format!("family write failed: {e}"))?;
    Ok(())
}

/// Members (not the owner) with display names, oldest first.
pub async fn family_members(
    pool: &PgPool,
    owner: &str,
) -> Result<Vec<(String, Option<String>, i64)>, String> {
    let rows = sqlx::query(
        r#"SELECT m."member_user_id", d."display_name", m."joined_at"
           FROM "family_members" m
           LEFT JOIN "user_display_cache" d ON d."user_id" = m."member_user_id"
           WHERE m."owner_user_id" = $1 ORDER BY m."joined_at" ASC"#,
    )
    .bind(uid(owner)?)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("family read failed: {e}"))?;
    rows.iter()
        .map(|row| {
            Ok((
                row.try_get::<Uuid, _>("member_user_id")?.to_string(),
                row.try_get::<Option<String>, _>("display_name")?,
                ms(row.try_get("joined_at")?),
            ))
        })
        .collect::<Result<_, sqlx::Error>>()
        .map_err(|e| format!("family decode failed: {e}"))
}

pub async fn display_name(pool: &PgPool, user_id: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, Option<String>>(
        r#"SELECT "display_name" FROM "user_display_cache" WHERE "user_id" = $1"#,
    )
    .bind(uid(user_id)?)
    .fetch_optional(pool)
    .await
    .map(Option::flatten)
    .map_err(|e| format!("display name read failed: {e}"))
}

/// Why a join was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JoinRefused {
    Full,
    AlreadyInFamily,
}

/// Add a member if the family has room; one transaction so two joins cannot
/// both take the last place.
pub async fn join_family(
    pool: &PgPool,
    owner: &str,
    member: &str,
    max_members: u32,
) -> Result<Result<(), JoinRefused>, String> {
    let owner_id = uid(owner)?;
    let member_id = uid(member)?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("family join begin failed: {e}"))?;
    // Serialise joins per family on the group row.
    sqlx::query(r#"SELECT 1 FROM "family_groups" WHERE "owner_user_id" = $1 FOR UPDATE"#)
        .bind(owner_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("family lock failed: {e}"))?;
    let existing = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT "owner_user_id" FROM "family_members" WHERE "member_user_id" = $1"#,
    )
    .bind(member_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| format!("family read failed: {e}"))?;
    if let Some(current) = existing {
        return Ok(if current == owner_id {
            Ok(())
        } else {
            Err(JoinRefused::AlreadyInFamily)
        });
    }
    let count = sqlx::query_scalar::<_, i64>(
        r#"SELECT count(*) FROM "family_members" WHERE "owner_user_id" = $1"#,
    )
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("family count failed: {e}"))?;
    // The owner takes one of the places.
    if count + 1 >= i64::from(max_members) {
        return Ok(Err(JoinRefused::Full));
    }
    sqlx::query(
        r#"INSERT INTO "family_members" ("member_user_id", "owner_user_id") VALUES ($1, $2)"#,
    )
    .bind(member_id)
    .bind(owner_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("family join failed: {e}"))?;
    tx.commit()
        .await
        .map_err(|e| format!("family join commit failed: {e}"))?;
    Ok(Ok(()))
}

/// Remove `member` from `owner`'s family (or from any family when `owner` is None).
pub async fn remove_family_member(
    pool: &PgPool,
    owner: Option<&str>,
    member: &str,
) -> Result<bool, String> {
    let result = match owner {
        Some(owner) => sqlx::query(
            r#"DELETE FROM "family_members" WHERE "member_user_id" = $1 AND "owner_user_id" = $2"#,
        )
        .bind(uid(member)?)
        .bind(uid(owner)?),
        None => sqlx::query(r#"DELETE FROM "family_members" WHERE "member_user_id" = $1"#)
            .bind(uid(member)?),
    }
    .execute(pool)
    .await
    .map_err(|e| format!("family remove failed: {e}"))?;
    Ok(result.rows_affected() > 0)
}
