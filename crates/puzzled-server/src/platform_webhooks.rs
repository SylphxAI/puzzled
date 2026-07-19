//! Platform jobs webhook product path (dens for `platform-webhooks`).
//!
//! Ports verification + dispatch from
//! `apps/puzzled/src/app/api/webhooks/platform-jobs/route.ts`.
//! Secret comparison is constant-time-ish for equal lengths; external Platform
//! transport remains the edge caller. FE UI stays TS.

use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::generation_jobs::{execute_job, is_known_job, JobResult};

/// Header names used by Platform job delivery.
pub const HEADER_APP_SECRET: &str = "x-app-secret";
pub const HEADER_CRON_NAME: &str = "x-sylphx-cron-name";
pub const HEADER_JOB_ID: &str = "x-sylphx-job-id";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationResult {
    pub valid: bool,
    pub error: Option<&'static str>,
}

/// Verify Platform webhook request (parity: verifyPlatformRequest).
#[must_use]
pub fn verify_platform_request(
    provided_secret: Option<&str>,
    expected_secret: &str,
) -> VerificationResult {
    let Some(secret) = provided_secret.map(str::trim).filter(|s| !s.is_empty()) else {
        return VerificationResult {
            valid: false,
            error: Some("Missing x-app-secret header"),
        };
    };
    if expected_secret.is_empty() {
        return VerificationResult {
            valid: false,
            error: Some("Server secret not configured"),
        };
    }
    if !secrets_equal(secret, expected_secret) {
        return VerificationResult {
            valid: false,
            error: Some("Invalid secret key"),
        };
    }
    VerificationResult {
        valid: true,
        error: None,
    }
}

/// Constant-time-ish equality for equal-length secrets; length mismatch fails fast.
#[must_use]
pub fn secrets_equal(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Extract cron name + job id from headers.
#[must_use]
pub fn extract_job_headers(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let cron = headers
        .get(HEADER_CRON_NAME)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let job_id = headers
        .get(HEADER_JOB_ID)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    (cron, job_id)
}

/// Handle a verified platform job delivery (product path).
#[must_use]
pub fn handle_platform_job(cron_name: &str, target_date: Option<&str>) -> (StatusCode, JobResult) {
    if !is_known_job(cron_name) {
        return (
            StatusCode::NOT_FOUND,
            JobResult {
                success: false,
                job: cron_name.to_string(),
                data: json!(null),
                error: Some(format!("Unknown job: {cron_name}")),
            },
        );
    }
    let result = execute_job(cron_name, target_date);
    let status = if result.success {
        StatusCode::OK
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, result)
}

// ── HTTP ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformJobBody {
    /// Optional payload date override for generate-daily-puzzles.
    pub date: Option<String>,
    pub payload: Option<serde_json::Value>,
}

/// POST /api/webhooks/platform-jobs
///
/// Expects headers: `x-app-secret`, `x-sylphx-cron-name`, optional `x-sylphx-job-id`.
/// Secret is read from env `SYLPHX_SECRET_KEY` (or `PUZZLED_APP_SECRET` fallback).
pub async fn platform_jobs_webhook(
    headers: HeaderMap,
    Json(body): Json<PlatformJobBody>,
) -> Response {
    let expected = std::env::var("SYLPHX_SECRET_KEY")
        .or_else(|_| std::env::var("PUZZLED_APP_SECRET"))
        .unwrap_or_default();

    let provided = headers.get(HEADER_APP_SECRET).and_then(|v| v.to_str().ok());

    let verification = verify_platform_request(provided, &expected);
    if !verification.valid {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": verification.error.unwrap_or("unauthorized"),
                "slice": "platform-webhooks",
            })),
        )
            .into_response();
    }

    let (cron, job_id) = extract_job_headers(&headers);
    let Some(cron_name) = cron else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "Missing X-Sylphx-Cron-Name header",
                "slice": "platform-webhooks",
            })),
        )
            .into_response();
    };

    let date = body.date.or_else(|| {
        body.payload
            .as_ref()
            .and_then(|p| p.get("date"))
            .and_then(|v| v.as_str().map(str::to_string))
    });

    let (status, result) = handle_platform_job(&cron_name, date.as_deref());
    (
        status,
        Json(json!({
            "success": result.success,
            "job": result.job,
            "jobId": job_id,
            "result": result.data,
            "error": result.error,
            "slice": "platform-webhooks",
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn verify_requires_secret() {
        let r = verify_platform_request(None, "secret");
        assert!(!r.valid);
        let r = verify_platform_request(Some("wrong"), "secret");
        assert!(!r.valid);
        let r = verify_platform_request(Some("secret"), "secret");
        assert!(r.valid);
    }

    #[test]
    fn secrets_equal_rejects_length_mismatch() {
        assert!(!secrets_equal("ab", "abc"));
        assert!(secrets_equal("abc", "abc"));
    }

    #[test]
    fn handle_unknown_job_404() {
        let (status, result) = handle_platform_job("nope", None);
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert!(!result.success);
    }

    #[test]
    fn handle_generate_job_ok() {
        let (status, result) = handle_platform_job("generate-daily-puzzles", Some("2024-12-25"));
        assert_eq!(status, StatusCode::OK);
        assert!(result.success);
    }

    #[test]
    fn extract_headers() {
        let mut h = HeaderMap::new();
        h.insert(
            HEADER_CRON_NAME,
            HeaderValue::from_static("generate-daily-puzzles"),
        );
        h.insert(HEADER_JOB_ID, HeaderValue::from_static("job-1"));
        let (c, j) = extract_job_headers(&h);
        assert_eq!(c.as_deref(), Some("generate-daily-puzzles"));
        assert_eq!(j.as_deref(), Some("job-1"));
    }
}
