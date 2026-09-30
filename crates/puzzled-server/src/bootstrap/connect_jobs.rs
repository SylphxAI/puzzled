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
use crate::shared::dest_http::{
    dest_email_connector_id, dest_email_delivery, dest_events_deliver, dest_push_connector_id,
    dest_push_delivery,
};
use crate::shared::tick_receipt::TickError;
use puzzled_core::puzzle_play::daily_time::product_day_key;

/// Result of one reminder tick: players reminded, and players whose send
/// failed (released, so the next tick retries them inside the grace window).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReminderOutcome {
    pub sent: u32,
    pub failed: u32,
}

impl ReminderOutcome {
    /// Every attempt failed and there were enough of them that this is the
    /// send path (credentials, connector, Events) being down, not one bad
    /// player. A lone failing player never fails the tick.
    pub fn send_path_down(&self) -> bool {
        self.sent == 0 && self.failed >= PATH_DOWN_MIN_FAILURES
    }
}

const PATH_DOWN_MIN_FAILURES: u32 = 3;
const MAX_LOGGED_ERROR_CHARS: usize = 240;

/// Stable, non-reversible player tag for logs (never the id or an address).
fn player_tag(user_id: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(user_id.as_bytes())
        .iter()
        .take(4)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn log_send_failure(user_id: &str, error: &str) {
    let error: String = error.chars().take(MAX_LOGGED_ERROR_CHARS).collect();
    tracing::warn!(player = %player_tag(user_id), %error, "daily reminder send failed");
}

/// Claim-and-send loop over an injectable sender. A failed send releases only
/// that player's claim; the rest of the batch is unaffected.
async fn send_claimed<F, Fut, R, RFut>(
    due: Vec<(String, String)>,
    mut send: F,
    mut release: R,
) -> ReminderOutcome
where
    F: FnMut(String) -> Fut,
    Fut: std::future::Future<Output = Result<(), String>>,
    R: FnMut(String) -> RFut,
    RFut: std::future::Future<Output = Result<(), String>>,
{
    let (mut sent, mut failed) = (0u32, 0u32);
    for (user_id, _time) in due {
        match send(user_id.clone()).await {
            Ok(()) => sent += 1,
            Err(error) => {
                failed += 1;
                log_send_failure(&user_id, &error);
                if let Err(error) = release(user_id.clone()).await {
                    log_send_failure(&user_id, &format!("release: {error}"));
                }
            }
        }
    }
    ReminderOutcome { sent, failed }
}

/// Send the daily reminders due at `now`, each at the player's own reminder
/// time in their own time zone (see [`jobs_db::claim_due_daily_reminders`]).
/// Safe to call as often as the schedule likes: a player is reminded once per
/// local day, and never after finishing today's puzzle. `Err` only when the
/// job cannot run at all (no connector, claim query failed).
pub async fn send_due_daily_reminders(
    pool: &sqlx::PgPool,
    now: chrono::DateTime<Utc>,
) -> Result<ReminderOutcome, Vec<String>> {
    let connector_id = dest_push_connector_id().map_err(|e| vec![e])?;
    let product_day = product_day_key(now).format("%Y-%m-%d").to_string();
    let due = jobs_db::claim_due_daily_reminders(pool, now, &product_day)
        .await
        .map_err(|e| vec![e])?;
    Ok(send_claimed(
        due,
        |user_id| {
            let delivery = dest_push_delivery(
                &connector_id,
                &user_id,
                "Your daily puzzle is ready",
                "Today's puzzle is waiting. It only takes a few minutes.",
                "/",
            );
            async move { dest_events_deliver(delivery).await }
        },
        |user_id| async move { jobs_db::release_daily_reminder(pool, &user_id).await },
    )
    .await)
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
        let outcome = send_due_daily_reminders(pool, Utc::now()).await?;
        if outcome.send_path_down() {
            return Err(vec![format!(
                "reminder send path down: {} failed, 0 sent",
                outcome.failed
            )]);
        }
        Ok(outcome.sent)
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[tokio::test]
    async fn one_failing_player_does_not_block_the_others() {
        let due = vec![
            ("a".to_string(), "08:00".to_string()),
            ("bad".to_string(), "08:00".to_string()),
            ("c".to_string(), "08:00".to_string()),
        ];
        let released = Mutex::new(Vec::new());
        let outcome = send_claimed(
            due,
            |id| async move {
                if id == "bad" {
                    Err("events dest returned 400".to_string())
                } else {
                    Ok(())
                }
            },
            |id| {
                released.lock().unwrap().push(id);
                async { Ok(()) }
            },
        )
        .await;
        assert_eq!(outcome, ReminderOutcome { sent: 2, failed: 1 });
        assert!(!outcome.send_path_down());
        assert_eq!(*released.lock().unwrap(), vec!["bad".to_string()]);
    }

    #[tokio::test]
    async fn every_send_failing_reads_as_path_down() {
        let due: Vec<_> = (0..3)
            .map(|i| (format!("u{i}"), "08:00".to_string()))
            .collect();
        let outcome = send_claimed(
            due,
            |_| async { Err("down".to_string()) },
            |_| async { Ok(()) },
        )
        .await;
        assert_eq!(outcome, ReminderOutcome { sent: 0, failed: 3 });
        assert!(outcome.send_path_down());
    }

    #[test]
    fn a_single_failure_is_not_path_down() {
        assert!(!ReminderOutcome { sent: 0, failed: 1 }.send_path_down());
        assert!(!ReminderOutcome { sent: 5, failed: 9 }.send_path_down());
    }

    #[test]
    fn player_tag_hides_the_id() {
        let tag = player_tag("11111111-2222-3333-4444-555555555555");
        assert_eq!(tag.len(), 8);
        assert!(!tag.contains('-'));
    }
}
