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
/// Completed reminders suppress later ticks on the same local day. Leases
/// recover interrupted workers; delivery-before-ack crashes may duplicate a
/// reminder (at-least-once). Finished players are excluded when claimed.
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
    let started = std::time::Instant::now();
    let elapsed_now = || {
        chrono::Duration::from_std(started.elapsed())
            .ok()
            .and_then(|elapsed| now.checked_add_signed(elapsed))
            .ok_or_else(|| vec!["daily reminder elapsed clock overflow".to_string()])
    };
    let mut claim_at = now;
    let mut processed = 0u32;
    loop {
        let product_day = product_day_key(claim_at).format("%Y-%m-%d").to_string();
        let due = jobs_db::claim_due_daily_reminders(pool, claim_at, &product_day)
            .await
            .map_err(|e| vec![e])?;
        if due.is_empty() {
            return Ok(processed);
        }
        let mut errors = Vec::new();
        for claim in due {
            let user_id = &claim.user_id;
            // Delivery returns success if any endpoint received the reminder;
            // only a wholly unsuccessful retryable delivery releases this claim.
            // Do not start abandoned batch work after its lease has expired.
            // Keep the adapter's per-endpoint timeout: cancelling a whole player
            // midway would discard its already-successful endpoint outcomes.
            let delivery_started_at = elapsed_now()?;
            if delivery_started_at >= claim.lease_until {
                errors.push(format!("{user_id}: reminder lease expired before delivery"));
                continue;
            }
            let delivery = send(user_id.clone()).await;
            let completed_at = elapsed_now()?;
            match delivery {
                Ok(()) => {
                    match jobs_db::acknowledge_daily_reminder(pool, &claim, completed_at).await {
                        Ok(true) => processed += 1,
                        Ok(false) => {
                            errors.push(format!("{user_id}: reminder lease expired or replaced"))
                        }
                        Err(e) => errors.push(format!("{user_id} acknowledge: {e}")),
                    }
                }
                Err(e) => {
                    errors.push(format!("{user_id}: {e}"));
                    if let Err(release) =
                        jobs_db::release_daily_reminder(pool, &claim, completed_at).await
                    {
                        errors.push(format!("{user_id} release: {release}"));
                    }
                }
            }
        }
        // Drain successful batches without limiting the whole tick to 16
        // players. Stop after a failed batch so released players are retried
        // by the next Compute tick, never immediately in a tight retry loop.
        if !errors.is_empty() {
            return Err(errors);
        }
        claim_at = elapsed_now()?;
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

#[cfg(test)]
mod tests {
    use super::send_due_daily_reminders_with;
    use crate::capabilities::preferences::adapters::web_push;
    use crate::daily_reminder_tests::reminder_database as fresh_database;
    use chrono::NaiveDate;
    use uuid::Uuid;

    /// Exercise consecutive Compute ticks through the real database claim/release
    /// loop, with no outbound delivery and no VAPID configuration.
    async fn consecutive_reminder_ticks(any_success: bool) {
        use crate::capabilities::preferences::adapters::web_push_sender::{
            PushDelivery, PushSender,
        };
        use ::web_push::SubscriptionInfo;
        use std::sync::atomic::{AtomicUsize, Ordering};

        struct TestSender {
            any_success: bool,
            attempts: AtomicUsize,
        }
        impl PushSender for TestSender {
            async fn send<'a>(
                &'a self,
                subscription: &'a SubscriptionInfo,
                _payload: &'a str,
            ) -> Result<PushDelivery, String> {
                self.attempts.fetch_add(1, Ordering::Relaxed);
                if self.any_success && subscription.endpoint.ends_with("live") {
                    Ok(PushDelivery::Delivered)
                } else {
                    Err("retryable failure".to_string())
                }
            }
        }
        let Some(pool) = fresh_database().await else {
            return;
        };
        let player = Uuid::now_v7();
        sqlx::query("INSERT INTO notification_preferences (user_id, push_enabled, push_daily_reminder, daily_reminder_time, timezone) VALUES ($1, true, true, '08:00', 'UTC')")
        .bind(player)
        .execute(&pool)
        .await
        .unwrap();
        let sender = TestSender {
            any_success,
            attempts: AtomicUsize::new(0),
        };
        let now = NaiveDate::from_ymd_opt(2026, 10, 1)
            .unwrap()
            .and_hms_opt(8, 0, 0)
            .unwrap()
            .and_utc();
        for tick in 0..2 {
            let result = send_due_daily_reminders_with(
                &pool,
                now + chrono::Duration::minutes(tick * 15),
                |user_id| {
                    let pool = &pool;
                    let sender = &sender;
                    async move {
                        let subscriptions = ["failed", "live"]
                            .into_iter()
                            .map(|suffix| {
                                SubscriptionInfo::new(
                                    format!("https://fcm.googleapis.com/fcm/send/{suffix}"),
                                    "public-key".to_string(),
                                    "auth-key".to_string(),
                                )
                            })
                            .collect();
                        web_push::deliver_subscriptions(
                            pool,
                            Uuid::parse_str(&user_id).unwrap(),
                            subscriptions,
                            "{}",
                            sender,
                        )
                        .await
                    }
                },
            )
            .await;
            if any_success {
                assert_eq!(result.unwrap(), if tick == 0 { 1 } else { 0 });
            } else {
                assert!(result.is_err());
            }
        }
        let claim: Option<NaiveDate> = sqlx::query_scalar(
            "SELECT last_daily_reminder_on FROM notification_preferences WHERE user_id = $1",
        )
        .bind(player)
        .fetch_one(&pool)
        .await
        .unwrap();
        if any_success {
            assert_eq!(sender.attempts.load(Ordering::Relaxed), 2);
            assert_eq!(claim, Some(now.date_naive()));
        } else {
            assert_eq!(sender.attempts.load(Ordering::Relaxed), 4);
            assert_eq!(claim, None);
        }
    }

    #[tokio::test]
    async fn mixed_success_keeps_daily_claim_across_consecutive_ticks() {
        consecutive_reminder_ticks(true).await;
    }

    #[tokio::test]
    async fn all_failed_releases_daily_claim_for_next_tick_retry() {
        consecutive_reminder_ticks(false).await;
    }
    #[tokio::test]
    async fn cancelled_worker_and_reconstructed_worker_recover_the_unacknowledged_batch() {
        use crate::capabilities::jobs::adapters::jobs_db::REMINDER_LEASE_SECONDS;
        let Some(pool) = fresh_database().await else {
            return;
        };
        for _ in 0..3 {
            sqlx::query("INSERT INTO notification_preferences (user_id, push_enabled, push_daily_reminder, daily_reminder_time, timezone) VALUES ($1, true, true, '08:00', 'UTC')")
                .bind(Uuid::now_v7()).execute(&pool).await.unwrap();
        }
        let now = "2026-10-01T08:00:00Z".parse().unwrap();
        let (entered, started) = tokio::sync::oneshot::channel();
        let worker_pool = pool.clone();
        let worker = tokio::spawn(async move {
            let mut entered = Some(entered);
            let mut attempts = 0;
            send_due_daily_reminders_with(&worker_pool, now, |_| {
                attempts += 1;
                let first = attempts == 1;
                if !first {
                    if let Some(entered) = entered.take() {
                        entered.send(()).unwrap();
                    }
                }
                async move {
                    if first {
                        Ok(())
                    } else {
                        std::future::pending::<Result<(), String>>().await
                    }
                }
            })
            .await
        });
        started.await.unwrap();
        worker.abort();
        assert!(worker.await.unwrap_err().is_cancelled());
        let delivered: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM notification_preferences WHERE last_daily_reminder_on IS NOT NULL",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(delivered, 1);
        // Reconstruct the executor with no in-memory claim state. It cannot steal
        // live leases; expiry recovers only the two not acknowledged as delivered.
        assert_eq!(
            send_due_daily_reminders_with(&pool, now, |_| async { Ok(()) })
                .await
                .unwrap(),
            0
        );
        let retried = now + chrono::Duration::seconds(REMINDER_LEASE_SECONDS);
        assert_eq!(
            send_due_daily_reminders_with(&pool, retried, |_| async { Ok(()) })
                .await
                .unwrap(),
            2
        );
        assert_eq!(
            send_due_daily_reminders_with(&pool, retried, |_| async { Ok(()) })
                .await
                .unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn successful_tick_drains_more_than_one_bounded_batch() {
        use crate::capabilities::jobs::adapters::jobs_db::REMINDER_CLAIM_BATCH;
        let Some(pool) = fresh_database().await else {
            return;
        };
        for _ in 0..(REMINDER_CLAIM_BATCH + 1) {
            sqlx::query("INSERT INTO notification_preferences (user_id, push_enabled, push_daily_reminder, daily_reminder_time, timezone) VALUES ($1, true, true, '08:00', 'UTC')")
                .bind(Uuid::now_v7()).execute(&pool).await.unwrap();
        }
        let now = "2026-10-01T08:00:00Z".parse().unwrap();
        assert_eq!(
            send_due_daily_reminders_with(&pool, now, |_| async { Ok(()) })
                .await
                .unwrap(),
            (REMINDER_CLAIM_BATCH + 1) as u32
        );
        assert_eq!(
            send_due_daily_reminders_with(&pool, now, |_| async { Ok(()) })
                .await
                .unwrap(),
            0
        );
    }
}
