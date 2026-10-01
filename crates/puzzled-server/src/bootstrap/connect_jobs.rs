//! Native Connect JobsService — the app's sole scheduled-work executor.
//!
//! Inbound: dest Events product credential (`Authorization: Bearer`).
//! Effects: dest Events `POST /v1/deliveries` (push + email).

use std::sync::Arc;

use chrono::Utc;
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};

use super::state::AppState;
use crate::capabilities::jobs::adapters::jobs_db;
use crate::proto::puzzled::v1::{JobsService, RunRetentionJobRequest, RunRetentionJobResponse};
use crate::shared::dest_http::{dest_email_connector_id, dest_email_delivery, dest_events_deliver};
use crate::shared::tick_receipt::TickError;
use puzzled_core::puzzle_play::daily_time::product_day_key;

/// Send the daily reminders due at `now`, each at the player's own reminder
/// time in their own time zone (see [`jobs_db::claim_due_daily_reminders`]).
/// Safe to call as often as the schedule likes: a player is reminded once per
/// local day, and never after finishing today's puzzle.
pub async fn send_due_daily_reminders(
    pool: &sqlx::PgPool,
    now: chrono::DateTime<Utc>,
) -> Result<u32, Vec<String>> {
    send_due_daily_reminders_with(pool, now, |user_id| async move {
        crate::capabilities::preferences::adapters::web_push::send_daily(pool, &user_id).await
    })
    .await
}

/// Injectable delivery keeps the real claim/release loop testable without
/// contacting browser push services or loading VAPID credentials.
pub(crate) async fn send_due_daily_reminders_with<F, Fut>(
    pool: &sqlx::PgPool,
    now: chrono::DateTime<Utc>,
    mut send: F,
) -> Result<u32, Vec<String>>
where
    F: FnMut(String) -> Fut,
    Fut: std::future::Future<Output = Result<(), String>>,
{
    let product_day = product_day_key(now).format("%Y-%m-%d").to_string();
    let due = jobs_db::claim_due_daily_reminders(pool, now, &product_day)
        .await
        .map_err(|e| vec![e])?;
    let mut errors = Vec::new();
    let mut processed = 0u32;
    for (user_id, _time) in due {
        // Delivery returns success if any endpoint received the reminder;
        // only a wholly unsuccessful retryable delivery releases this claim.
        match send(user_id.clone()).await {
            Ok(()) => processed += 1,
            Err(e) => {
                errors.push(format!("{user_id}: {e}"));
                if let Err(release) = jobs_db::release_daily_reminder(pool, &user_id).await {
                    errors.push(format!("{user_id} release: {release}"));
                }
            }
        }
    }
    if errors.is_empty() {
        Ok(processed)
    } else {
        Err(errors)
    }
}

#[derive(Clone)]
pub struct JobsConnectService {
    state: AppState,
}

impl JobsConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    /// Admit a scheduled call: Compute's signed tick receipt for this exact
    /// URL. The Events product key used before was never set in production,
    /// so every call was refused; a shared bearer is not an admission.
    async fn admit_tick(&self, ctx: &RequestContext) -> Result<(), ConnectError> {
        self.state
            .ticks
            .admit(ctx.headers(), "/puzzled.v1.JobsService/RunRetentionJob")
            .await
            .map_err(|error| match error {
                TickError::Unavailable => {
                    ConnectError::new(ErrorCode::Unavailable, "tick_receipt_unavailable")
                }
                _ => ConnectError::new(ErrorCode::Unauthenticated, "tick_receipt_invalid"),
            })
    }

    async fn run_daily_reminder(&self) -> Result<u32, Vec<String>> {
        let Some(pool) = &self.state.pool else {
            return Err(vec!["no database pool".to_string()]);
        };
        send_due_daily_reminders(pool, Utc::now()).await
    }

    async fn run_win_back_emails(&self) -> Result<u32, Vec<String>> {
        let Some(pool) = &self.state.pool else {
            return Err(vec!["no database pool".to_string()]);
        };
        let connector_id = dest_email_connector_id().map_err(|e| vec![e])?;
        let mut errors = Vec::new();
        let mut processed = 0u32;
        let today = Utc::now().date_naive();
        for (email_type, days) in [("day7", 7i64), ("day14", 14i64), ("day30", 30i64)] {
            let targets = jobs_db::win_back_targets(pool, email_type, days)
                .await
                .map_err(|e| vec![e])?;
            for (user_id, email) in targets {
                let subject = "We miss you at Puzzled";
                let text_body = format!("Come back and play today's puzzle ({email_type}).");
                let delivery = dest_email_delivery(
                    &connector_id,
                    &user_id,
                    &email,
                    email_type,
                    subject,
                    &text_body,
                );
                match dest_events_deliver(delivery).await {
                    Ok(()) => {
                        if let Err(e) =
                            jobs_db::record_win_back_email(pool, &user_id, email_type, today).await
                        {
                            errors.push(format!("{user_id} record: {e}"));
                        } else {
                            processed += 1;
                        }
                    }
                    Err(e) => errors.push(format!("{user_id}: {e}")),
                }
            }
        }
        if errors.is_empty() {
            Ok(processed)
        } else {
            Err(errors)
        }
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl JobsService for JobsConnectService {
    async fn run_retention_job(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, RunRetentionJobRequest>,
    ) -> ServiceResult<RunRetentionJobResponse> {
        self.admit_tick(&ctx).await?;
        let req = request.to_owned_message();
        let (ok, processed, errors) = match req.name.trim() {
            "daily-reminder" => match self.run_daily_reminder().await {
                Ok(n) => (true, n, Vec::new()),
                Err(errors) => (false, 0, errors),
            },
            "win-back-emails" => match self.run_win_back_emails().await {
                Ok(n) => (true, n, Vec::new()),
                Err(errors) => (false, 0, errors),
            },
            "audit-log-retention" => match &self.state.pool {
                Some(pool) => match jobs_db::purge_audit_logs(pool).await {
                    Ok((stripped, deleted)) => (
                        true,
                        u32::try_from(stripped + deleted).unwrap_or(u32::MAX),
                        Vec::new(),
                    ),
                    Err(error) => (false, 0, vec![error]),
                },
                None => (false, 0, vec!["no database pool".to_string()]),
            },
            other => {
                return Err(ConnectError::new(
                    ErrorCode::InvalidArgument,
                    format!("unknown job: {other}"),
                ));
            }
        };
        Response::ok(RunRetentionJobResponse {
            ok,
            processed,
            errors,
            ..Default::default()
        })
    }
}

pub fn jobs_connect_service(state: AppState) -> Arc<JobsConnectService> {
    Arc::new(JobsConnectService::new(state))
}
