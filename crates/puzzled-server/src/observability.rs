//! Error capture into Sylphx Observability (OBS-ERRORS).
//!
//! One occurrence per captured error, posted to the Observability error API
//! with the environment's Access key (`SYLPHX_API_KEY`, minted and injected
//! by the platform). Captures panics and every 5xx response.
//!
//! Observability is a soft dependency: capture runs on a spawned task with a
//! short timeout, never blocks or fails a request, and without a key only
//! logs. Messages, stacks, and tags are scrubbed of email addresses, secrets,
//! and URL query strings; request and response bodies are never attached.
//!
//! The generated SDK method (`sylphx::observability` on api.sylphx.com) is not
//! served yet; this module moves to it when it is (see docs/observability.md).

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::extract::{MatchedPath, Request};
use axum::middleware::Next;
use axum::response::Response;
use serde_json::{json, Value};

const DEFAULT_ORIGIN: &str = "https://api.observability.sylphx.com";
const CAPTURE_PATH: &str = "/v1/error-events:captureException";
const TIMEOUT: Duration = Duration::from_secs(3);

/// One error to capture.
#[derive(Debug, Default, Clone)]
pub struct ErrorReport {
    pub exception_type: String,
    pub message: String,
    /// Route template (never a concrete path with ids or a query string).
    pub route: Option<String>,
    /// Backtrace or stack text, when available.
    pub stack: Option<String>,
    pub tags: Vec<(String, String)>,
}

struct Sink {
    client: reqwest::Client,
    url: String,
    key: Option<String>,
    service: String,
    release: Option<String>,
    environment: Option<String>,
}

static SINK: OnceLock<Sink> = OnceLock::new();
static SEQ: AtomicU64 = AtomicU64::new(0);

fn env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
}

/// Reads the platform environment and installs the panic hook. Call once at startup.
pub fn init() {
    let origin = env("SYLPHX_OBSERVABILITY_URL").unwrap_or_else(|| DEFAULT_ORIGIN.to_owned());
    let sink = Sink {
        client: reqwest::Client::builder()
            .timeout(TIMEOUT)
            .build()
            .unwrap_or_default(),
        url: format!("{}{CAPTURE_PATH}", origin.trim_end_matches('/')),
        key: env("SYLPHX_API_KEY"),
        service: env("SYLPHX_SERVICE_NAME").unwrap_or_else(|| "api".to_owned()),
        release: env("SYLPHX_GIT_COMMIT_SHA"),
        environment: env("SYLPHX_ENVIRONMENT_TYPE"),
    };
    if sink.key.is_none() {
        tracing::warn!("observability capture off: SYLPHX_API_KEY is not set");
    }
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
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()));
        capture(ErrorReport {
            exception_type: "panic".to_owned(),
            message,
            stack: location,
            ..ErrorReport::default()
        });
        previous(info);
    }));
}

/// Removes email addresses, credentials, and URL query strings.
pub fn scrub(text: &str) -> String {
    text.split_inclusive(char::is_whitespace)
        .map(|word| {
            let bare = word.trim_end();
            let tail = &word[bare.len()..];
            let lower = bare.to_ascii_lowercase();
            let is_email = bare.split_once('@').is_some_and(|(user, domain)| {
                !user.is_empty() && domain.contains('.') && !domain.starts_with('.')
            });
            let is_secret = [
                "sylphx_sk_",
                "sylphx_pk_",
                "sk_live_",
                "sk_test_",
                "pk_live_",
                "pk_test_",
                "eyj",
            ]
            .iter()
            .any(|p| {
                lower
                    .trim_start_matches(|c: char| !c.is_ascii_alphanumeric())
                    .starts_with(p)
            });
            if is_email {
                format!("[email]{tail}")
            } else if is_secret {
                format!("[secret]{tail}")
            } else if let Some((head, _)) = bare.split_once('?').filter(|(h, _)| h.contains('/')) {
                format!("{head}{tail}")
            } else {
                word.to_owned()
            }
        })
        .collect()
}

fn clip(text: String, max: usize) -> String {
    if text.len() <= max {
        return text;
    }
    let mut end = max;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_owned()
}

fn normalized(text: &str) -> String {
    text.chars()
        .map(|c| if c.is_ascii_digit() { '0' } else { c })
        .collect()
}

fn attribute(key: &str, value: &str) -> Value {
    json!({ "key": key, "value": { "stringValue": clip(scrub(value), 1000) } })
}

/// The request body for one occurrence; public for tests.
pub fn capture_body(
    report: &ErrorReport,
    service: &str,
    release: Option<&str>,
    environment: Option<&str>,
) -> Value {
    let message = clip(scrub(&report.message), 1000);
    let stack = report.stack.as_deref().map(|s| clip(scrub(s), 8000));
    // Group by type, route, and the message with digits folded, so ids do not split groups.
    let signature = format!(
        "{}\n{}\n{}",
        report.exception_type,
        report.route.as_deref().unwrap_or(""),
        normalized(&message)
    );
    let mut tags: Vec<Value> = report
        .tags
        .iter()
        .take(32)
        .map(|(k, v)| attribute(k, v))
        .collect();
    if let Some(environment) = environment {
        tags.push(attribute("environment", environment));
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let key = format!(
        "{}-{}-{}-{}",
        service,
        now.as_nanos(),
        std::process::id(),
        SEQ.fetch_add(1, Ordering::Relaxed)
    );
    json!({
        "idempotencyKey": key,
        "event": {
            "service": service,
            "release": release,
            "fingerprint": {
                "exceptionType": clip(report.exception_type.clone(), 200),
                "stackSignature": clip(signature, 2000),
                "culprit": report.route.as_deref().map(scrub).unwrap_or_default(),
            },
            "message": message,
            "route": report.route.as_deref().map(scrub),
            "tags": tags,
            "extra": stack.map(|s| vec![json!({ "key": "stack", "value": { "stringValue": s } })]).unwrap_or_default(),
        }
    })
}

/// Captures one error on a background task. Never blocks, never fails.
pub fn capture(report: ErrorReport) {
    let Some(sink) = SINK.get() else { return };
    tracing::error!(exception_type = %report.exception_type, route = ?report.route, "{}", scrub(&report.message));
    let Some(key) = sink.key.clone() else { return };
    let Ok(handle) = tokio::runtime::Handle::try_current() else {
        return;
    };
    let body = capture_body(
        &report,
        &sink.service,
        sink.release.as_deref(),
        sink.environment.as_deref(),
    );
    let request = sink.client.post(&sink.url).bearer_auth(key).json(&body);
    handle.spawn(async move {
        match request.send().await {
            Ok(response) if response.status().is_success() => {}
            Ok(response) => {
                tracing::warn!(status = %response.status(), "observability capture refused")
            }
            Err(error) => tracing::warn!(%error, "observability capture failed"),
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
    fn scrub_removes_emails_secrets_and_queries() {
        assert_eq!(
            scrub("for jane@example.com key sylphx_sk_live_abc at /pay?card=1 ok"),
            "for [email] key [secret] at /pay ok"
        );
    }

    #[test]
    fn equal_errors_share_a_fingerprint_and_ids_do_not_split_them() {
        let a = ErrorReport {
            exception_type: "HTTP 500".into(),
            message: "job 123 failed".into(),
            route: Some("/jobs/{id}".into()),
            ..Default::default()
        };
        let b = ErrorReport {
            message: "job 987 failed".into(),
            ..a.clone()
        };
        let c = ErrorReport {
            exception_type: "HTTP 502".into(),
            ..a.clone()
        };
        let fp = |r: &ErrorReport| {
            capture_body(r, "api", Some("abc"), None)["event"]["fingerprint"].clone()
        };
        assert_eq!(fp(&a), fp(&b));
        assert_ne!(fp(&a), fp(&c));
        let one = capture_body(&a, "api", None, None);
        let two = capture_body(&a, "api", None, None);
        assert_ne!(one["idempotencyKey"], two["idempotencyKey"]);
    }

    #[test]
    fn body_never_carries_an_email() {
        let r = ErrorReport {
            exception_type: "E".into(),
            message: "bad user a@b.co".into(),
            stack: Some("at x (a@b.co)".into()),
            ..Default::default()
        };
        assert!(!capture_body(&r, "api", None, Some("production"))
            .to_string()
            .contains("a@b.co"));
    }
}
