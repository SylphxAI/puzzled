//! Puzzled Plus application flows: entitlement, Stripe read-back, checkout,
//! cancellation with the statutory refund window, and webhook handling.
//!
//! Money rule (owner commercial standard): a webhook is a hint. Every state
//! change is read back from Stripe before it is stored, and the ledger gets
//! one append-only row per payment or refund.

use chrono::Utc;
use serde_json::Value;
use sqlx::PgPool;
use tracing::warn;

use puzzled_core::billing_access::policy::{
    cancellation, is_family_plan, is_known_plan, refund_until_ms, subscription_grants_access,
    Cancellation,
};

use super::adapters::billing_db::{self, SubscriptionRow};
use super::adapters::stripe::{path_segment, Stripe, StripeSubscription};

/// Where the account's access comes from.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Entitlement {
    pub entitled: bool,
    /// The account's own subscription that grants access, if any.
    pub own: Option<SubscriptionRow>,
    /// Refund window end for `own`.
    pub refund_until_ms: Option<i64>,
    /// Owner of the family plan that grants access, if access comes from one.
    pub family_owner: Option<String>,
}

/// Is `user_id` a Platform account (a UUID), not a guest-day id?
#[must_use]
pub fn is_account_id(user_id: &str) -> bool {
    uuid::Uuid::parse_str(user_id).is_ok()
}

fn granting(rows: &[SubscriptionRow], now_ms: i64) -> Option<SubscriptionRow> {
    rows.iter()
        .rev()
        .find(|row| subscription_grants_access(&row.status, row.current_period_end_ms, now_ms))
        .cloned()
}

/// Read a subscription back from Stripe and store it.
pub async fn sync_subscription(pool: &PgPool, stripe: &Stripe, id: &str) -> Result<(), String> {
    let sub = stripe.subscription(id).await?;
    store_subscription(pool, &sub).await
}

async fn store_subscription(pool: &PgPool, sub: &StripeSubscription) -> Result<(), String> {
    let owner = match billing_db::user_for_customer(pool, &sub.customer).await? {
        Some(user) => Some(user),
        None => sub.user_id.clone().filter(|u| is_account_id(u)),
    };
    billing_db::upsert_subscription(pool, owner.as_deref(), sub).await
}

/// Read every subscription of the account's customer back from Stripe.
pub async fn sync_user(pool: &PgPool, stripe: &Stripe, user_id: &str) -> Result<(), String> {
    let Some(customer) = billing_db::customer_for_user(pool, user_id).await? else {
        return Ok(());
    };
    for sub in stripe.customer_subscriptions(&customer).await? {
        billing_db::upsert_subscription(pool, Some(user_id), &sub).await?;
    }
    Ok(())
}

/// Stored rows whose paid period has passed while Stripe still calls them live
/// are read back once (a missed renewal webhook must not lock a paying player).
async fn refresh_stale(
    pool: &PgPool,
    stripe: Option<&Stripe>,
    rows: &[SubscriptionRow],
    now_ms: i64,
) -> bool {
    let Some(stripe) = stripe else {
        return false;
    };
    let mut refreshed = false;
    for row in rows {
        let live = matches!(row.status.as_str(), "active" | "trialing" | "past_due");
        if live && row.current_period_end_ms <= now_ms {
            match sync_subscription(pool, stripe, &row.stripe_subscription_id).await {
                Ok(()) => refreshed = true,
                Err(error) => warn!(%error, "stale subscription read-back failed"),
            }
        }
    }
    refreshed
}

/// The account's entitlement from its own subscription or a family plan.
pub async fn entitlement(
    pool: &PgPool,
    stripe: Option<&Stripe>,
    user_id: &str,
) -> Result<Entitlement, String> {
    if !is_account_id(user_id) {
        return Ok(Entitlement::default());
    }
    let now_ms = Utc::now().timestamp_millis();
    let mut rows = billing_db::subscriptions_for_user(pool, user_id).await?;
    if refresh_stale(pool, stripe, &rows, now_ms).await {
        rows = billing_db::subscriptions_for_user(pool, user_id).await?;
    }
    if let Some(own) = granting(&rows, now_ms) {
        let first = rows
            .first()
            .is_some_and(|r| r.stripe_subscription_id == own.stripe_subscription_id);
        return Ok(Entitlement {
            entitled: true,
            refund_until_ms: refund_until_ms(own.started_at_ms, first),
            own: Some(own),
            family_owner: None,
        });
    }
    if let Some(owner) = billing_db::family_owner_of(pool, user_id).await? {
        if family_plan_active(pool, stripe, &owner).await? {
            return Ok(Entitlement {
                entitled: true,
                own: None,
                refund_until_ms: None,
                family_owner: Some(owner),
            });
        }
    }
    Ok(Entitlement::default())
}

/// Does `owner` hold a family plan that grants access now?
pub async fn family_plan_active(
    pool: &PgPool,
    stripe: Option<&Stripe>,
    owner: &str,
) -> Result<bool, String> {
    let now_ms = Utc::now().timestamp_millis();
    let mut rows = billing_db::subscriptions_for_user(pool, owner).await?;
    if refresh_stale(pool, stripe, &rows, now_ms).await {
        rows = billing_db::subscriptions_for_user(pool, owner).await?;
    }
    Ok(rows.iter().any(|row| {
        is_family_plan(&row.plan_id)
            && subscription_grants_access(&row.status, row.current_period_end_ms, now_ms)
    }))
}

/// Why a checkout could not be started.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckoutError {
    UnknownPlan,
    PlanNotOnSale,
    AlreadySubscribed,
    Failed(String),
}

/// Find or create the account's Stripe customer.
pub async fn ensure_customer(
    pool: &PgPool,
    stripe: &Stripe,
    user_id: &str,
    email: Option<&str>,
    name: Option<&str>,
) -> Result<String, String> {
    if let Some(customer) = billing_db::customer_for_user(pool, user_id).await? {
        return Ok(customer);
    }
    let mut form = vec![("metadata[user_id]".to_string(), user_id.to_string())];
    if let Some(email) = email.filter(|e| !e.is_empty()) {
        form.push(("email".to_string(), email.to_string()));
    }
    if let Some(name) = name.filter(|n| !n.is_empty()) {
        form.push(("name".to_string(), name.to_string()));
    }
    // One customer per account even when two checkouts race.
    let key = format!("puzzled-customer-{user_id}");
    let customer = stripe.post("/v1/customers", &form, Some(&key)).await?;
    let id = customer
        .get("id")
        .and_then(Value::as_str)
        .ok_or("stripe customer has no id")?;
    billing_db::insert_customer(pool, user_id, id).await
}

/// Return-URL path prefix for a locale: en-US has none, the others use the
/// canonical tag (`/en-GB`, `/zh-HK`), matching the web routing.
fn locale_prefix(locale: &str) -> &'static str {
    match locale.to_ascii_lowercase().as_str() {
        "en-gb" => "/en-GB",
        "zh-cn" => "/zh-CN",
        "zh-hk" => "/zh-HK",
        "zh-tw" => "/zh-TW",
        _ => "",
    }
}

/// Start a Stripe Checkout session for `plan_id`.
#[allow(clippy::too_many_arguments)]
pub async fn create_checkout(
    pool: &PgPool,
    stripe: &Stripe,
    user_id: &str,
    email: Option<&str>,
    name: Option<&str>,
    plan_id: &str,
    locale: &str,
    currency: &str,
) -> Result<String, CheckoutError> {
    if !is_known_plan(plan_id) {
        return Err(CheckoutError::UnknownPlan);
    }
    let current = entitlement(pool, Some(stripe), user_id)
        .await
        .map_err(CheckoutError::Failed)?;
    if current.own.is_some() {
        return Err(CheckoutError::AlreadySubscribed);
    }
    let prices = stripe.prices().await.map_err(CheckoutError::Failed)?;
    let price = prices
        .iter()
        .find(|p| p.plan_id == plan_id)
        .ok_or(CheckoutError::PlanNotOnSale)?;
    let customer = ensure_customer(pool, stripe, user_id, email, name)
        .await
        .map_err(CheckoutError::Failed)?;
    let base = format!("{}{}", stripe.public_url(), locale_prefix(locale));
    let mut form: Vec<(String, String)> = vec![
        ("mode".into(), "subscription".into()),
        ("customer".into(), customer),
        ("client_reference_id".into(), user_id.into()),
        ("line_items[0][price]".into(), price.id.clone()),
        ("line_items[0][quantity]".into(), "1".into()),
        ("metadata[user_id]".into(), user_id.into()),
        ("metadata[plan_id]".into(), plan_id.into()),
        (
            "subscription_data[metadata][user_id]".into(),
            user_id.into(),
        ),
        (
            "subscription_data[metadata][plan_id]".into(),
            plan_id.into(),
        ),
        (
            "success_url".into(),
            format!("{base}/settings/subscription?checkout=success"),
        ),
        (
            "cancel_url".into(),
            format!("{base}/pricing?checkout=cancelled"),
        ),
        ("billing_address_collection".into(), "auto".into()),
        ("locale".into(), "auto".into()),
        (
            "custom_text[submit][message]".into(),
            "Sold by Sylphx Limited (UK). Prices include VAT. Renews automatically until you \
             cancel in Settings. Cancel within 14 days of your first subscription for a full \
             refund."
                .into(),
        ),
    ];
    let currency = currency.trim().to_ascii_lowercase();
    if price.amounts.iter().any(|(code, _)| *code == currency) {
        form.push(("currency".into(), currency));
    }
    let session = stripe
        .post("/v1/checkout/sessions", &form, None)
        .await
        .map_err(CheckoutError::Failed)?;
    session
        .get("url")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| CheckoutError::Failed("checkout session has no url".into()))
}

/// A Stripe Customer Portal session (payment method, invoices, plan change).
pub async fn create_portal(
    pool: &PgPool,
    stripe: &Stripe,
    user_id: &str,
    locale: &str,
) -> Result<Option<String>, String> {
    let Some(customer) = billing_db::customer_for_user(pool, user_id).await? else {
        return Ok(None);
    };
    let mut form = vec![
        ("customer".to_string(), customer),
        (
            "return_url".to_string(),
            format!(
                "{}{}/settings/subscription",
                stripe.public_url(),
                locale_prefix(locale)
            ),
        ),
    ];
    if let Some(configuration) = portal_configuration(stripe).await? {
        form.push(("configuration".to_string(), configuration));
    }
    let session = stripe
        .post("/v1/billing_portal/sessions", &form, None)
        .await?;
    Ok(session
        .get("url")
        .and_then(Value::as_str)
        .map(str::to_string))
}

/// The portal configuration made by `scripts/stripe-setup.ts` (metadata app=puzzled).
async fn portal_configuration(stripe: &Stripe) -> Result<Option<String>, String> {
    let body = stripe
        .get(
            "/v1/billing_portal/configurations",
            &[("active", "true"), ("limit", "100")],
        )
        .await?;
    Ok(body
        .get("data")
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().find(|item| {
                item.pointer("/metadata/app").and_then(Value::as_str) == Some("puzzled")
            })
        })
        .and_then(|item| item.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string))
}

/// Result of a cancellation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cancelled {
    pub refunded: bool,
    pub access_ends_at_ms: i64,
}

/// Cancel the account's own subscription.
///
/// Inside the refund window the paid invoices are refunded first (idempotent
/// per invoice), then the subscription ends now. After it, the subscription
/// stops renewing and access runs to the end of the paid period.
pub async fn cancel(
    pool: &PgPool,
    stripe: &Stripe,
    user_id: &str,
) -> Result<Option<Cancelled>, String> {
    let current = entitlement(pool, Some(stripe), user_id).await?;
    let Some(own) = current.own else {
        return Ok(None);
    };
    let id = path_segment(&own.stripe_subscription_id)?.to_string();
    let now_ms = Utc::now().timestamp_millis();
    match cancellation(current.refund_until_ms, now_ms) {
        Cancellation::RefundNow => {
            refund_subscription(pool, stripe, user_id, &id).await?;
            stripe.delete(&format!("/v1/subscriptions/{id}")).await?;
            sync_subscription(pool, stripe, &id).await?;
            Ok(Some(Cancelled {
                refunded: true,
                access_ends_at_ms: now_ms,
            }))
        }
        Cancellation::AtPeriodEnd => {
            stripe
                .post(
                    &format!("/v1/subscriptions/{id}"),
                    &[("cancel_at_period_end".into(), "true".into())],
                    None,
                )
                .await?;
            sync_subscription(pool, stripe, &id).await?;
            Ok(Some(Cancelled {
                refunded: false,
                access_ends_at_ms: own.current_period_end_ms,
            }))
        }
    }
}

/// Undo a pending cancellation (the subscription renews again).
pub async fn resume(pool: &PgPool, stripe: &Stripe, user_id: &str) -> Result<bool, String> {
    let current = entitlement(pool, Some(stripe), user_id).await?;
    let Some(own) = current.own.filter(|o| o.cancel_at_period_end) else {
        return Ok(false);
    };
    let id = path_segment(&own.stripe_subscription_id)?.to_string();
    stripe
        .post(
            &format!("/v1/subscriptions/{id}"),
            &[("cancel_at_period_end".into(), "false".into())],
            None,
        )
        .await?;
    sync_subscription(pool, stripe, &id).await?;
    Ok(true)
}

async fn refund_subscription(
    pool: &PgPool,
    stripe: &Stripe,
    user_id: &str,
    subscription: &str,
) -> Result<(), String> {
    let invoices = stripe
        .get(
            "/v1/invoices",
            &[
                ("subscription", subscription),
                ("status", "paid"),
                ("limit", "10"),
            ],
        )
        .await?;
    for invoice in invoices
        .get("data")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        record_invoice_payment(pool, invoice).await?;
        let Some(charge) = invoice.get("charge").and_then(Value::as_str) else {
            continue;
        };
        let invoice_id = invoice.get("id").and_then(Value::as_str).unwrap_or(charge);
        let key = format!("puzzled-refund-{invoice_id}");
        let refund = stripe
            .post(
                "/v1/refunds",
                &[
                    ("charge".into(), charge.to_string()),
                    ("reason".into(), "requested_by_customer".into()),
                    ("metadata[user_id]".into(), user_id.to_string()),
                ],
                Some(&key),
            )
            .await?;
        let customer = invoice
            .get("customer")
            .and_then(Value::as_str)
            .unwrap_or_default();
        record_refund(pool, &refund, customer, Some(subscription)).await?;
    }
    Ok(())
}

/// Ledger row for a paid invoice.
pub async fn record_invoice_payment(pool: &PgPool, invoice: &Value) -> Result<(), String> {
    let (Some(id), Some(customer)) = (
        invoice.get("id").and_then(Value::as_str),
        invoice.get("customer").and_then(Value::as_str),
    ) else {
        return Err("invoice without id or customer".into());
    };
    let amount = invoice
        .get("amount_paid")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    if invoice.get("status").and_then(Value::as_str) != Some("paid") || amount <= 0 {
        return Ok(());
    }
    let user = billing_db::user_for_customer(pool, customer).await?;
    let paid_at = invoice
        .pointer("/status_transitions/paid_at")
        .and_then(Value::as_i64)
        .or_else(|| invoice.get("created").and_then(Value::as_i64))
        .unwrap_or_else(|| Utc::now().timestamp());
    billing_db::append_ledger(
        pool,
        id,
        "payment",
        user.as_deref(),
        customer,
        invoice.get("subscription").and_then(Value::as_str),
        invoice
            .get("currency")
            .and_then(Value::as_str)
            .unwrap_or("usd"),
        amount,
        paid_at,
    )
    .await?;
    Ok(())
}

/// Ledger row (negative) for a refund Stripe reports as succeeded or pending.
pub async fn record_refund(
    pool: &PgPool,
    refund: &Value,
    customer: &str,
    subscription: Option<&str>,
) -> Result<(), String> {
    let Some(id) = refund.get("id").and_then(Value::as_str) else {
        return Err("refund without id".into());
    };
    let status = refund.get("status").and_then(Value::as_str).unwrap_or("");
    if !matches!(status, "succeeded" | "pending") {
        return Ok(());
    }
    let amount = refund.get("amount").and_then(Value::as_i64).unwrap_or(0);
    let user = billing_db::user_for_customer(pool, customer).await?;
    billing_db::append_ledger(
        pool,
        id,
        "refund",
        user.as_deref(),
        customer,
        subscription,
        refund
            .get("currency")
            .and_then(Value::as_str)
            .unwrap_or("usd"),
        -amount,
        refund
            .get("created")
            .and_then(Value::as_i64)
            .unwrap_or_else(|| Utc::now().timestamp()),
    )
    .await?;
    Ok(())
}

/// Apply one verified Stripe event by reading the objects it names back from
/// Stripe. Unknown event types are acknowledged and ignored.
pub async fn handle_event(pool: &PgPool, stripe: &Stripe, event: &Value) -> Result<(), String> {
    let event_type = event.get("type").and_then(Value::as_str).unwrap_or("");
    let object = event
        .pointer("/data/object")
        .cloned()
        .unwrap_or(Value::Null);
    let object_id = object.get("id").and_then(Value::as_str);
    if let Some(event_id) = event.get("id").and_then(Value::as_str) {
        billing_db::record_webhook_event(
            pool,
            event_id,
            event_type,
            event.get("created").and_then(Value::as_i64).unwrap_or(0),
            object_id,
        )
        .await?;
    }
    match event_type {
        "checkout.session.completed" => {
            if let Some(sub) = object.get("subscription").and_then(Value::as_str) {
                sync_subscription(pool, stripe, sub).await?;
            }
        }
        "customer.subscription.created"
        | "customer.subscription.updated"
        | "customer.subscription.deleted"
        | "customer.subscription.paused"
        | "customer.subscription.resumed" => {
            if let Some(id) = object_id {
                sync_subscription(pool, stripe, id).await?;
            }
        }
        "invoice.paid" | "invoice.payment_failed" => {
            if let Some(id) = object_id {
                let invoice = stripe
                    .get(&format!("/v1/invoices/{}", path_segment(id)?), &[])
                    .await?;
                record_invoice_payment(pool, &invoice).await?;
                if let Some(sub) = invoice.get("subscription").and_then(Value::as_str) {
                    sync_subscription(pool, stripe, sub).await?;
                }
            }
        }
        "charge.refunded" => {
            if let Some(charge) = object_id {
                let charge = path_segment(charge)?;
                let charge_body = stripe.get(&format!("/v1/charges/{charge}"), &[]).await?;
                let refunds = stripe
                    .get("/v1/refunds", &[("charge", charge), ("limit", "20")])
                    .await?;
                let subscription = match charge_body.get("invoice").and_then(Value::as_str) {
                    Some(invoice) => stripe
                        .get(&format!("/v1/invoices/{}", path_segment(invoice)?), &[])
                        .await?
                        .get("subscription")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    None => None,
                };
                let customer = charge_body
                    .get("customer")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                for refund in refunds
                    .get("data")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    record_refund(pool, refund, customer, subscription.as_deref()).await?;
                }
            }
        }
        _ => {}
    }
    Ok(())
}
