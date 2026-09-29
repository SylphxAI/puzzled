//! Steps 1 and 2: grants, cancel at period end, email; then the readback.

use chrono::{DateTime, NaiveDateTime, Utc};
use puzzled_core::billing_access::policy::{is_family_plan, FAMILY_MAX_MEMBERS};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::capabilities::billing::adapters::stripe::{path_segment, Stripe};
use crate::capabilities::billing::service::sync_subscription;
use crate::capabilities::money::access::{FEATURE_FAMILY, FEATURE_PLUS, FEATURE_SEATS};
use crate::capabilities::money::client::{GrantRecord, Money};

/// The migration is idempotent on this reason: it is part of the request body
/// a key was first used with, so it never changes for a subscription.
#[must_use]
pub fn reason(subscription_id: &str) -> String {
    format!("legacy stripe sub {subscription_id} migrated")
}

/// A live subscription that has not yet been moved.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LiveRow {
    pub subscription_id: String,
    pub user_id: String,
    pub plan_id: String,
    pub period_end: DateTime<Utc>,
    pub cancel_at_period_end: bool,
}

fn utc(naive: NaiveDateTime) -> DateTime<Utc> {
    naive.and_utc()
}

/// Live rows: active, trialing or past due, with an account.
pub async fn live_rows(pool: &PgPool) -> Result<Vec<LiveRow>, String> {
    let rows = sqlx::query(
        r#"SELECT "stripe_subscription_id", "user_id", "plan_id", "current_period_end",
                  "cancel_at_period_end"
           FROM "billing_subscriptions"
           WHERE "status" IN ('active', 'trialing', 'past_due') AND "user_id" IS NOT NULL
           ORDER BY "started_at", "stripe_subscription_id""#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("live subscriptions read failed: {e}"))?;
    rows.iter()
        .map(|row| {
            Ok(LiveRow {
                subscription_id: row
                    .try_get("stripe_subscription_id")
                    .map_err(|e| e.to_string())?,
                user_id: row
                    .try_get::<Uuid, _>("user_id")
                    .map_err(|e| e.to_string())?
                    .to_string(),
                plan_id: row.try_get("plan_id").map_err(|e| e.to_string())?,
                period_end: utc(row
                    .try_get("current_period_end")
                    .map_err(|e| e.to_string())?),
                cancel_at_period_end: row
                    .try_get("cancel_at_period_end")
                    .map_err(|e| e.to_string())?,
            })
        })
        .collect()
}

/// The grants one row needs: `plus`, and for a family plan also `family` and
/// the `seats` limit, so the plan's members keep the access they have.
/// (feature, limit, idempotency key). The first key is the old subscription
/// id, as the Money contract prescribes; the others append the feature so no
/// key ever meets a different body.
#[must_use]
pub fn wanted(row: &LiveRow) -> Vec<(&'static str, Option<u32>, String)> {
    let mut wanted = vec![(FEATURE_PLUS, None, row.subscription_id.clone())];
    if is_family_plan(&row.plan_id) {
        wanted.push((
            FEATURE_FAMILY,
            None,
            format!("{}:{FEATURE_FAMILY}", row.subscription_id),
        ));
        wanted.push((
            FEATURE_SEATS,
            Some(FAMILY_MAX_MEMBERS),
            format!("{}:{FEATURE_SEATS}", row.subscription_id),
        ));
    }
    wanted
}

/// What one run did, as counts.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Report {
    pub live: u32,
    pub granted: u32,
    pub already_granted: u32,
    pub cancelled: u32,
    pub already_cancelled: u32,
    pub emailed: u32,
    pub no_email: u32,
    pub skipped_ended: u32,
    pub failed: u32,
}

/// Grants Money already holds, by feature.
struct Existing(Vec<GrantRecord>);

impl Existing {
    async fn read(money: &Money) -> Result<Self, String> {
        let mut all = Vec::new();
        for feature in [FEATURE_PLUS, FEATURE_FAMILY, FEATURE_SEATS] {
            all.extend(
                money
                    .manual_grants(feature)
                    .await
                    .map_err(|e| e.to_string())?,
            );
        }
        Ok(Self(all))
    }

    fn has(&self, user_id: &str, feature: &str, reason: &str) -> bool {
        self.0
            .iter()
            .any(|g| g.user_id == user_id && g.feature == feature && g.reason == reason)
    }
}

async fn user_email(pool: &PgPool, user_id: &str) -> Result<Option<String>, String> {
    let user = Uuid::parse_str(user_id).map_err(|e| e.to_string())?;
    sqlx::query_scalar::<_, Option<String>>(
        r#"SELECT "email" FROM "user_display_cache" WHERE "user_id" = $1"#,
    )
    .bind(user)
    .fetch_optional(pool)
    .await
    .map(Option::flatten)
    .map_err(|e| format!("email read failed: {e}"))
}

/// The one email, as an Events delivery. Its idempotency key is the old
/// subscription id, so a rerun queues nothing new.
#[must_use]
pub fn email_delivery(
    connector_id: &str,
    row: &LiveRow,
    email: &str,
    public_url: &str,
    sender: &str,
) -> Value {
    let date = row.period_end.format("%-d %B %Y");
    let text = format!(
        "Your Puzzled Plus continues until {date}; nothing changes before then.\n\n\
         To keep it after that, re-subscribe in one tap at the same price:\n\
         {}/pricing?plan={}\n",
        public_url.trim_end_matches('/'),
        row.plan_id
    );
    json!({
        "idempotency_key": format!("plus-migration-{}", row.subscription_id),
        "intent": {"email": {
            "connector_id": connector_id,
            "message": {
                "sender": {"address": sender},
                "to": [{"address": email}],
                "subject": "Your Puzzled Plus is moving",
                "text_body": text,
            }
        }},
        "retry_policy": {"max_attempts": 5},
    })
}

/// Where the email goes; a seam so tests need no Events service.
pub trait Mailer: Sync {
    fn send(&self, delivery: Value)
        -> impl std::future::Future<Output = Result<(), String>> + Send;
    fn connector(&self) -> Result<String, String>;
    fn sender(&self) -> String;
}

/// The product's existing Events email path.
pub struct EventsMailer;

impl Mailer for EventsMailer {
    async fn send(&self, delivery: Value) -> Result<(), String> {
        crate::shared::dest_http::dest_events_deliver(delivery).await
    }
    fn connector(&self) -> Result<String, String> {
        crate::shared::dest_http::dest_email_connector_id()
    }
    fn sender(&self) -> String {
        std::env::var("EVENTS_EMAIL_FROM")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "noreply@puzzled.gg".to_string())
    }
}

/// Step 1: for every live row, in this order: Money grants (list first, skip
/// what exists), Stripe cancel at period end, one email. A row that fails
/// stops only itself; the run reports `failed` and can be repeated.
pub async fn run_grants(
    pool: &PgPool,
    stripe: &Stripe,
    money: &Money,
    mailer: &impl Mailer,
) -> Result<Report, String> {
    let rows = live_rows(pool).await?;
    let mut report = Report {
        live: rows.len() as u32,
        ..Default::default()
    };
    if rows.is_empty() {
        return Ok(report);
    }
    let existing = Existing::read(money).await?;
    let connector = mailer.connector();
    let sender = mailer.sender();
    for row in &rows {
        if row.period_end <= Utc::now() {
            // Money refuses a grant that ends in the past; Stripe's next sync
            // moves the row out of "live" on its own.
            report.skipped_ended += 1;
            continue;
        }
        let why = reason(&row.subscription_id);
        let mut ok = true;
        // 1. Money grants.
        for (feature, limit, key) in wanted(row) {
            if existing.has(&row.user_id, feature, &why) {
                report.already_granted += 1;
                continue;
            }
            let mut body = json!({
                "subject": {"end_user": row.user_id},
                "feature": feature,
                "expire_time": row.period_end.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
                "reason": why,
            });
            if let Some(limit) = limit {
                body["limit"] = json!(limit.to_string());
            }
            match money.create_grant(&key, &body).await {
                Ok(()) => report.granted += 1,
                Err(error) => {
                    tracing::warn!(%error, "subscriber migration: grant failed");
                    ok = false;
                }
            }
        }
        if !ok {
            report.failed += 1;
            continue;
        }
        // 2. Stripe: stop renewing (the Stripe client's last use).
        if row.cancel_at_period_end {
            report.already_cancelled += 1;
        } else {
            let done = async {
                let id = path_segment(&row.subscription_id)?;
                stripe
                    .post(
                        &format!("/v1/subscriptions/{id}"),
                        &[("cancel_at_period_end".into(), "true".into())],
                        None,
                    )
                    .await?;
                sync_subscription(pool, stripe, id).await
            }
            .await;
            match done {
                Ok(()) => report.cancelled += 1,
                Err(error) => {
                    tracing::warn!(%error, "subscriber migration: cancel at period end failed");
                    report.failed += 1;
                    continue;
                }
            }
        }
        // 3. One email; Events dedupes on the key.
        match user_email(pool, &row.user_id).await {
            Ok(Some(email)) => match &connector {
                Ok(connector) => {
                    let delivery =
                        email_delivery(connector, row, &email, stripe.public_url(), &sender);
                    match mailer.send(delivery).await {
                        Ok(()) => report.emailed += 1,
                        Err(error) => {
                            tracing::warn!(%error, "subscriber migration: email failed");
                            report.failed += 1;
                        }
                    }
                }
                Err(error) => {
                    tracing::warn!(%error, "subscriber migration: email not configured");
                    report.failed += 1;
                }
            },
            Ok(None) => report.no_email += 1,
            Err(error) => {
                tracing::warn!(%error, "subscriber migration: email lookup failed");
                report.failed += 1;
            }
        }
    }
    tracing::info!(
        live = report.live,
        granted = report.granted,
        already_granted = report.already_granted,
        cancelled = report.cancelled,
        emailed = report.emailed,
        failed = report.failed,
        "subscriber migration grants run"
    );
    Ok(report)
}

/// Step 2 result: rows still missing something.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Verification {
    pub live: u32,
    pub missing_grant: u32,
    pub still_renewing: u32,
}

impl Verification {
    #[must_use]
    pub fn complete(&self) -> bool {
        self.missing_grant == 0 && self.still_renewing == 0
    }
}

/// Readback: every live row has its Money grants, and Stripe itself says the
/// subscription will cancel at period end. Ended rows are not live.
pub async fn verify(pool: &PgPool, stripe: &Stripe, money: &Money) -> Result<Verification, String> {
    let rows = live_rows(pool).await?;
    let mut out = Verification {
        live: rows.len() as u32,
        ..Default::default()
    };
    if rows.is_empty() {
        return Ok(out);
    }
    let existing = Existing::read(money).await?;
    for row in &rows {
        let why = reason(&row.subscription_id);
        if row.period_end > Utc::now()
            && !wanted(row)
                .iter()
                .all(|(feature, _, _)| existing.has(&row.user_id, feature, &why))
        {
            out.missing_grant += 1;
        }
        let cancelling = stripe
            .subscription(&row.subscription_id)
            .await
            .map(|s| s.cancel_at_period_end)
            .unwrap_or(false);
        if !cancelling {
            out.still_renewing += 1;
        }
    }
    tracing::info!(
        live = out.live,
        missing_grant = out.missing_grant,
        still_renewing = out.still_renewing,
        "subscriber migration readback"
    );
    Ok(out)
}
