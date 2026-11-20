//! Checkout statutory disclosure / consent audit record, one small row per
//! checkout started:
//! - One-off digital pass (UK CCR 2013 Reg 37): buyer requested immediate
//!   supply and acknowledged losing the 14-day cancellation right.
//! - Recurring subscription (UK CCR 2013 Reg 36): buyer started an ongoing
//!   subscription with immediate access under proportionate 14-day
//!   cancellation terms (never waiving the 14-day right).
//!
//! It is a record of what the buyer saw/agreed to, not a billing table: Money
//! holds every payment.

use sqlx::PgPool;
use uuid::Uuid;

/// The one-off digital-content waiver statement (UK CCR 2013 Reg 37; en-US
/// source text). Stored with the row so the record reads on its own.
pub const IMMEDIATE_SUPPLY_STATEMENT: &str =
    "I want access now and understand I lose the 14-day cancellation right.";

/// The recurring subscription statement (UK CCR 2013 Reg 36; en-US source
/// text). Stored with the row so the record reads on its own.
pub const RECURRING_SUPPLY_STATEMENT: &str = "Access starts immediately; if you cancel within 14 days, you pay only a proportionate amount for the service supplied.";

#[must_use]
pub const fn statement_for(one_time_pass: bool) -> &'static str {
    if one_time_pass {
        IMMEDIATE_SUPPLY_STATEMENT
    } else {
        RECURRING_SUPPLY_STATEMENT
    }
}

pub async fn record(
    pool: &PgPool,
    user_id: &str,
    plan_id: &str,
    price_key: &str,
    locale: &str,
    one_time_pass: bool,
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
    .bind(statement_for(one_time_pass))
    .execute(pool)
    .await
    .map(|_| ())
    .map_err(|e| e.to_string())
}
