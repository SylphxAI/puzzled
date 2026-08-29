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
use crate::capabilities::identity_access::adapters::platform_jwt::extract_bearer;
use crate::capabilities::jobs::adapters::jobs_db;
use crate::proto::puzzled::v1::{JobsService, RunRetentionJobRequest, RunRetentionJobResponse};
use crate::shared::dest_http::{
    dest_email_connector_id, dest_email_delivery, dest_events_credential, dest_events_deliver,
    dest_push_connector_id, dest_push_delivery,
};

fn constant_time_eq(a: &str, b: &str) -> bool {
    let ha = sha256(a.as_bytes());
    let hb = sha256(b.as_bytes());
    ha == hb
}

fn sha256(input: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(input);
    hasher.finalize().into()
}

#[derive(Clone)]
pub struct JobsConnectService {
    state: AppState,
}

impl JobsConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    fn verify_dest_events_credential(&self, ctx: &RequestContext) -> Result<(), ConnectError> {
        let expected = dest_events_credential().unwrap_or_default();
        if expected.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "events_dest_not_configured",
            ));
        }
        let provided = extract_bearer(ctx.headers()).unwrap_or_default();
        if !constant_time_eq(&provided, &expected) {
            return Err(ConnectError::new(
                ErrorCode::Unauthenticated,
                "invalid_dest_credential",
            ));
        }
        Ok(())
    }

    async fn run_daily_reminder(&self) -> Result<u32, Vec<String>> {
        let Some(pool) = &self.state.pool else {
            return Err(vec!["no database pool".to_string()]);
        };
        let targets = jobs_db::daily_reminder_targets(pool)
            .await
            .map_err(|e| vec![e])?;
        let connector_id = dest_push_connector_id().map_err(|e| vec![e])?;
        let mut errors = Vec::new();
        let mut processed = 0u32;
        for (user_id, time) in targets {
            let title = "Your daily puzzle is ready";
            let body = format!("Play today's puzzles — your daily reminder is set for {time}.");
            let delivery = dest_push_delivery(&connector_id, &user_id, title, &body, "/");
            match dest_events_deliver(delivery).await {
                Ok(()) => processed += 1,
                Err(e) => errors.push(format!("{user_id}: {e}")),
            }
        }
        if errors.is_empty() {
            Ok(processed)
        } else {
            Err(errors)
        }
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
        self.verify_dest_events_credential(&ctx)?;
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
