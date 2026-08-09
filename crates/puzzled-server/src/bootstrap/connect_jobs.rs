//! Native Connect JobsService — the app's sole scheduled-work executor.
//!
//! Authenticated with the platform app secret (x-app-secret header,
//! constant-time compare). Effects are delivered through the Platform BaaS
//! HTTP API (email + push), never through a web residual service.

use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use reqwest::header::{HeaderMap as ReqHeaderMap, HeaderValue, CONTENT_TYPE};
use serde_json::json;

use super::state::AppState;
use crate::capabilities::jobs::adapters::jobs_db;
use crate::proto::puzzled::v1::{JobsService, RunRetentionJobRequest, RunRetentionJobResponse};

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

    fn verify_secret(&self, ctx: &RequestContext) -> Result<(), ConnectError> {
        let expected = std::env::var("SYLPHX_SECRET_KEY")
            .or_else(|_| std::env::var("PUZZLED_APP_SECRET"))
            .unwrap_or_default();
        if expected.trim().is_empty() {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "app_secret_not_configured",
            ));
        }
        let provided = ctx
            .headers()
            .get("x-app-secret")
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default();
        if !constant_time_eq(provided, &expected) {
            return Err(ConnectError::new(
                ErrorCode::Unauthenticated,
                "invalid_app_secret",
            ));
        }
        Ok(())
    }

    async fn platform_post(&self, path: &str, body: serde_json::Value) -> Result<(), String> {
        let base = std::env::var("SYLPHX_PLATFORM_URL")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "https://sylphx.com".to_string());
        let secret = std::env::var("SYLPHX_SECRET_KEY")
            .or_else(|_| std::env::var("PUZZLED_APP_SECRET"))
            .unwrap_or_default();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| format!("platform client build failed: {e}"))?;
        let mut headers = ReqHeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            "x-app-secret",
            HeaderValue::from_str(&secret).map_err(|e| e.to_string())?,
        );
        let response = client
            .post(format!("{base}{path}"))
            .headers(headers)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("platform request failed: {e}"))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("platform {path} returned {status}: {text}"));
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
        let mut errors = Vec::new();
        let mut processed = 0u32;
        for (user_id, time) in targets {
            match self
                .platform_post(
                    "/notifications/send",
                    json!({
                        "userId": user_id,
                        "title": "Your daily puzzle is ready",
                        "body": format!("Play today's puzzles — your daily reminder is set for {time}."),
                        "url": "/",
                    }),
                )
                .await
            {
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
        let mut errors = Vec::new();
        let mut processed = 0u32;
        let today = Utc::now().date_naive();
        for (email_type, days) in [("day7", 7i64), ("day14", 14i64), ("day30", 30i64)] {
            let targets = jobs_db::win_back_targets(pool, email_type, days)
                .await
                .map_err(|e| vec![e])?;
            for (user_id, email) in targets {
                match self
                    .platform_post(
                        "/email/send-to-user",
                        json!({
                            "userId": user_id,
                            "template": "win-back",
                            "data": { "emailType": email_type, "email": email },
                        }),
                    )
                    .await
                {
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
        self.verify_secret(&ctx)?;
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
