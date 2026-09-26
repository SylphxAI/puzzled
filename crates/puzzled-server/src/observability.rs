//! Error capture into Sylphx Observability (OBS-ERRORS) through the Sylphx
//! SDK: `sylphx::observability` `error_groups().capture` on api.sylphx.com
//! with the environment's Access key (`SYLPHX_API_KEY`, minted and injected
//! by the platform). Captures panics and every 5xx response.
//!
//! The service groups by exception type and in-app frames (never by release)
//! and scrubs secrets, tokens, card numbers and email addresses before
//! storing. This module never attaches a request or response body, so auth
//! and billing payloads cannot reach an error report.
//!
//! Observability is a soft dependency: capture runs on a spawned task with a
//! short timeout, never blocks or fails a request, and without a key only
//! logs.

use std::sync::OnceLock;
use std::time::Duration;

use axum::extract::{MatchedPath, Request};
use axum::middleware::Next;
use axum::response::Response;
use sylphx::observability::{CaptureErrorRequest, ErrorEvent, StackFrame};

/// The key's own org, project and environment.
pub const PARENT: &str = "orgs/-/projects/-/envs/-";
const TIMEOUT: Duration = Duration::from_secs(3);

/// One error to capture.
#[derive(Debug, Default, Clone)]
pub struct ErrorReport {
    pub exception_type: String,
    pub message: String,
    /// Route template (never a concrete path with ids or a query string).
    pub route: Option<String>,
    /// Source location, for panics.
    pub file: Option<String>,
    pub line: Option<u32>,
    pub tags: Vec<(String, String)>,
}

struct Sink {
    client: Option<sylphx::Client>,
    service: String,
    release: String,
    environment: Option<String>,
}

static SINK: OnceLock<Sink> = OnceLock::new();

fn env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
}

/// Reads the platform environment and installs the panic hook. Call once at startup.
pub fn init() {
    let client = env("SYLPHX_API_KEY").and_then(|key| {
        sylphx::HttpTransport::builder()
            .api_key(key)
            .timeout(TIMEOUT)
            .max_retries(1)
            .build()
            .map(sylphx::Client::new)
            .map_err(|error| tracing::warn!(%error, "observability client not built"))
            .ok()
    });
    if client.is_none() {
        tracing::warn!("observability capture off: SYLPHX_API_KEY is not set");
    }
    let sink = Sink {
        client,
        service: env("SYLPHX_SERVICE_NAME").unwrap_or_else(|| "api".to_owned()),
        release: env("SYLPHX_GIT_COMMIT_SHA").unwrap_or_default(),
        environment: env("SYLPHX_ENVIRONMENT_TYPE"),
    };
    if SINK.set(sink).is_err() {
        return;
    }
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| (*s).to_owned())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "panic".to_owned());
        capture(ErrorReport {
            exception_type: "panic".to_owned(),
            message,
            file: info.location().map(|l| l.file().to_owned()),
            line: info.location().map(|l| l.line()),
            ..ErrorReport::default()
        });
        previous(info);
    }));
}

/// The error event for one occurrence; public for tests.
pub fn error_event(
    report: &ErrorReport,
    service: &str,
    release: &str,
    environment: Option<&str>,
) -> ErrorEvent {
    let mut event = ErrorEvent::default();
    event.exception_type = report.exception_type.clone();
    event.message = report.message.chars().take(2000).collect();
    event.service_name = service.to_owned();
    event.release = release.to_owned();
    for (key, value) in report.tags.iter().take(60) {
        event.tags.insert(key.clone(), value.clone());
    }
    if let Some(environment) = environment {
        event
            .tags
            .insert("environment".to_owned(), environment.to_owned());
    }
    if let Some(route) = &report.route {
        let route = route.split(['?', '#']).next().unwrap_or_default();
        event.tags.insert("route".to_owned(), route.to_owned());
        // Group 5xx responses by route and status, not by the message.
        event.fingerprint = format!("{}\n{route}", report.exception_type);
    }
    if let Some(file) = &report.file {
        let mut frame = StackFrame::default();
        frame.file_path = file.clone();
        frame.line = report
            .line
            .map_or(0, |l| i32::try_from(l).unwrap_or(i32::MAX));
        frame.app_frame = !file.contains("/.cargo/") && !file.starts_with("/rustc/");
        event.stack_frames = vec![frame];
    }
    event
}

/// Captures one error on a background task. Never blocks, never fails.
pub fn capture(report: ErrorReport) {
    let Some(sink) = SINK.get() else { return };
    tracing::error!(exception_type = %report.exception_type, route = ?report.route, "{}", report.message);
    if sink.client.is_none() {
        return;
    }
    let Ok(handle) = tokio::runtime::Handle::try_current() else {
        return;
    };
    let mut request = CaptureErrorRequest::default();
    request.parent = PARENT.to_owned();
    request.error_event = Some(error_event(
        &report,
        &sink.service,
        &sink.release,
        sink.environment.as_deref(),
    ));
    handle.spawn(async move {
        let Some(client) = SINK.get().and_then(|s| s.client.as_ref()) else {
            return;
        };
        if let Err(error) = client.observability().error_groups().capture(request).await {
            tracing::warn!(%error, "observability capture failed");
        }
    });
}

/// Axum middleware: captures every 5xx response (route template and status only).
pub async fn capture_server_errors(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(|p| p.as_str().to_owned())
        .unwrap_or_else(|| request.uri().path().to_owned());
    let response = next.run(request).await;
    let status = response.status();
    if status.is_server_error() {
        capture(ErrorReport {
            exception_type: format!("HTTP {}", status.as_u16()),
            message: format!("{method} {route} returned {status}"),
            route: Some(route),
            tags: vec![("status".to_owned(), status.as_u16().to_string())],
            ..ErrorReport::default()
        });
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_errors_group_by_route_and_status() {
        let a = ErrorReport {
            exception_type: "HTTP 500".into(),
            message: "POST /jobs/{id} returned 500".into(),
            route: Some("/jobs/{id}?x=1".into()),
            ..Default::default()
        };
        let c = ErrorReport {
            exception_type: "HTTP 502".into(),
            ..a.clone()
        };
        let event = error_event(&a, "api", "abc", Some("production"));
        assert_eq!(event.fingerprint, "HTTP 500\n/jobs/{id}");
        assert_ne!(
            event.fingerprint,
            error_event(&c, "api", "abc", None).fingerprint
        );
        assert_eq!(
            event.tags.get("route").map(String::as_str),
            Some("/jobs/{id}")
        );
        assert_eq!(
            event.tags.get("environment").map(String::as_str),
            Some("production")
        );
        assert_eq!(event.release, "abc");
    }

    #[test]
    fn panics_carry_their_location_as_an_app_frame() {
        let r = ErrorReport {
            exception_type: "panic".into(),
            message: "boom".into(),
            file: Some("crates/app/src/main.rs".into()),
            line: Some(12),
            ..Default::default()
        };
        let event = error_event(&r, "api", "", None);
        assert_eq!(event.stack_frames.len(), 1);
        assert!(event.stack_frames[0].app_frame);
        assert_eq!(event.stack_frames[0].line, 12);
        assert!(event.fingerprint.is_empty());
    }
}
