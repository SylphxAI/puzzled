//! Error capture into Sylphx Observability (OBS-ERRORS) through the Sylphx
//! SDK: `sylphx::observability` `error_groups().capture` on api.sylphx.com
//! with the environment's Access key (`SYLPHX_API_KEY`, minted and injected
//! by the platform). Captures panics and every 5xx response.
//!
//! Each event carries the service, release (`SYLPHX_GIT_COMMIT_SHA`),
//! environment (`SYLPHX_ENVIRONMENT_TYPE`), the route template (never the raw
//! path or query), the error kind and message, and a stack. Message, stack
//! strings and tag values are scrubbed here ([`scrub`]) before they leave the
//! process; the service scrubs again on ingest. No request or response body
//! and no header is ever attached.
//!
//! Observability is a soft dependency and never blocks or fails a request:
//! a [`Reporter`] builds, scrubs and rate-limits an event (the same
//! fingerprint at most once per 10 s), then `try_send`s it into a bounded
//! queue (64) drained by ONE worker task ([`run_worker`]) with a 3 s call
//! timeout. A full queue drops the event and counts it. Without a key the
//! reporter only logs.

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock, PoisonError};
use std::time::{Duration, Instant};

use axum::extract::{MatchedPath, Request};
use axum::middleware::Next;
use axum::response::Response;
use sylphx::observability::{CaptureErrorRequest, ErrorEvent, StackFrame};
use tokio::sync::mpsc;

/// The key's own org, project and environment.
pub const PARENT: &str = "orgs/-/projects/-/envs/-";
/// Route placeholder when no route template matched (never the raw path).
pub const UNMATCHED_ROUTE: &str = "unmatched";
const TIMEOUT: Duration = Duration::from_secs(3);
/// The same fingerprint is sent at most once per this window.
pub const RATE_WINDOW: Duration = Duration::from_secs(10);
/// Events waiting for the worker; more are dropped, never awaited.
pub const QUEUE_CAPACITY: usize = 64;
const MAX_FRAMES: usize = 50;
const MAX_MESSAGE_CHARS: usize = 2000;
const MAX_LIMITER_ENTRIES: usize = 1024;

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
    /// `std::backtrace::Backtrace` text, for panics.
    pub backtrace: Option<String>,
    pub tags: Vec<(String, String)>,
}

/// Who is reporting.
#[derive(Debug, Clone, Default)]
pub struct Config {
    pub service: String,
    pub release: String,
    pub environment: Option<String>,
}

// ---------------------------------------------------------------- scrubbing

const REDACTED: &str = "[redacted]";
const KEY_WORDS: [&str; 7] = [
    "secret",
    "token",
    "password",
    "passwd",
    "key",
    "authorization",
    "cookie",
];
const KEY_PREFIXES: [&str; 11] = [
    "sylphx_",
    "sk_",
    "pk_",
    "rk_",
    "ghp_",
    "gho_",
    "ghs_",
    "ghu_",
    "github_pat_",
    "xoxb-",
    "xoxp-",
];

/// Replaces secrets with `[redacted]`: emails, `Bearer`/`Basic` credentials,
/// JWTs, API keys (`sylphx_`, `sk_`, `pk_`, `ghp_` ...), values of
/// `key=value` / `"key":"value"` pairs whose key contains secret, token,
/// password, key, authorization or cookie, long (32+ characters) hex or
/// base64-like strings, and 13-19 digit card-like numbers. Ordinary text is
/// left as is.
pub fn scrub(input: &str) -> String {
    let text = scrub_bearer(input);
    let text = scrub_cards(&text);
    let text = scrub_pairs(&text);
    scrub_words(&text)
}

fn is_credential_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'~' | b'+' | b'/' | b'=' | b'-')
}

fn scrub_bearer(text: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let bytes = text.as_bytes();
    let mut out = String::with_capacity(text.len());
    let (mut cursor, mut from) = (0, 0);
    while from < lower.len() {
        let hit = ["bearer ", "basic "]
            .iter()
            .filter_map(|scheme| {
                let mut search = from;
                while let Some(i) = lower[search..].find(scheme) {
                    let start = search + i;
                    if start == 0 || !bytes[start - 1].is_ascii_alphanumeric() {
                        return Some((start, start + scheme.len()));
                    }
                    search = start + 1;
                }
                None
            })
            .min();
        let Some((start, after)) = hit else { break };
        let mut end = after;
        while end < bytes.len() && is_credential_byte(bytes[end]) {
            end += 1;
        }
        if end - after >= 8 {
            out.push_str(&text[cursor..start]);
            out.push_str(REDACTED);
            cursor = end;
        }
        from = end.max(after);
    }
    out.push_str(&text[cursor..]);
    out
}

/// 13-19 digits, optionally grouped by single spaces or dashes.
fn scrub_cards(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = String::with_capacity(text.len());
    let (mut cursor, mut i) = (0, 0);
    while i < bytes.len() {
        let starts_run =
            bytes[i].is_ascii_digit() && (i == 0 || !bytes[i - 1].is_ascii_alphanumeric());
        if !starts_run {
            i += 1;
            continue;
        }
        let (mut j, mut digits) = (i, 0);
        loop {
            if j < bytes.len() && bytes[j].is_ascii_digit() {
                digits += 1;
                j += 1;
            } else if j + 1 < bytes.len()
                && matches!(bytes[j], b' ' | b'-')
                && bytes[j + 1].is_ascii_digit()
            {
                j += 1;
            } else {
                break;
            }
        }
        if (13..=19).contains(&digits) {
            out.push_str(&text[cursor..i]);
            out.push_str(REDACTED);
            cursor = j;
        }
        i = j;
    }
    out.push_str(&text[cursor..]);
    out
}

fn is_key_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.' | b'-')
}

/// Redacts the value after `key=` / `key:` / `"key":` when the key contains a
/// secret-like word.
fn scrub_pairs(text: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let bytes = text.as_bytes();
    let len = bytes.len();
    let mut out = String::with_capacity(text.len());
    let (mut cursor, mut pos) = (0, 0);
    while pos < len {
        let Some((_, kend)) = KEY_WORDS
            .iter()
            .filter_map(|k| lower[pos..].find(k).map(|i| (pos + i, pos + i + k.len())))
            .min()
        else {
            break;
        };
        let mut i = kend;
        while i < len && is_key_byte(bytes[i]) {
            i += 1;
        }
        if i < len && matches!(bytes[i], b'"' | b'\'') {
            i += 1;
        }
        while i < len && matches!(bytes[i], b' ' | b'\t') {
            i += 1;
        }
        let mut next = kend;
        if i < len && matches!(bytes[i], b':' | b'=') && bytes.get(i + 1) != Some(&b':') {
            i += 1;
            while i < len && bytes[i].is_ascii_whitespace() {
                i += 1;
            }
            if i < len {
                let end = match bytes[i] {
                    q @ (b'"' | b'\'') => {
                        text[i + 1..].find(q as char).map_or(len, |p| i + 1 + p + 1)
                    }
                    _ => {
                        let mut e = i;
                        while e < len
                            && !bytes[e].is_ascii_whitespace()
                            && !matches!(bytes[e], b',' | b';' | b'&' | b'}' | b')' | b']')
                        {
                            e += 1;
                        }
                        e
                    }
                };
                if end > i {
                    out.push_str(&text[cursor..i]);
                    out.push_str(REDACTED);
                    cursor = end;
                    next = end;
                }
            }
        }
        pos = next;
    }
    out.push_str(&text[cursor..]);
    out
}

fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric()
        || matches!(
            b,
            b'_' | b'-' | b'.' | b'+' | b'/' | b'=' | b'@' | b'%' | b'~'
        )
}

fn is_secret_word(word: &str) -> bool {
    if word.starts_with("eyJ") && word.len() >= 16 && word.contains('.') {
        return true;
    }
    let lower = word.to_ascii_lowercase();
    if KEY_PREFIXES
        .iter()
        .any(|p| lower.starts_with(p) && word.len() >= p.len() + 8)
    {
        return true;
    }
    if let Some(at) = word.find('@') {
        let domain = &word[at + 1..];
        if at > 0
            && domain.contains('.')
            && !domain.ends_with('.')
            && domain.starts_with(|c: char| c.is_ascii_alphanumeric())
        {
            return true;
        }
    }
    word.len() >= 32
        && word
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'_' | b'=' | b'-'))
        && word.bytes().any(|b| b.is_ascii_digit())
}

fn scrub_words(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = String::with_capacity(text.len());
    let (mut cursor, mut i) = (0, 0);
    while i < bytes.len() {
        if !is_word_byte(bytes[i]) {
            i += 1;
            continue;
        }
        let start = i;
        while i < bytes.len() && is_word_byte(bytes[i]) {
            i += 1;
        }
        let mut end = i;
        while end > start && bytes[end - 1] == b'.' {
            end -= 1;
        }
        if end > start && is_secret_word(&text[start..end]) {
            out.push_str(&text[cursor..start]);
            out.push_str(REDACTED);
            cursor = end;
        }
    }
    out.push_str(&text[cursor..]);
    out
}

// ------------------------------------------------------------------- events

fn is_app_path(file: &str) -> bool {
    !file.is_empty()
        && !file.contains("/.cargo/")
        && !file.contains("/registry/")
        && !file.starts_with("/rustc/")
}

fn split_location(loc: &str) -> (String, i32, i32) {
    let parts: Vec<&str> = loc.rsplitn(3, ':').collect();
    match parts.as_slice() {
        [col, line, file] => match (col.parse::<i32>(), line.parse::<i32>()) {
            (Ok(col), Ok(line)) => ((*file).to_owned(), line, col),
            _ => (loc.to_owned(), 0, 0),
        },
        [line, file] => line.parse::<i32>().map_or_else(
            |_| (loc.to_owned(), 0, 0),
            |line| ((*file).to_owned(), line, 0),
        ),
        _ => (loc.to_owned(), 0, 0),
    }
}

/// Panic and backtrace machinery, never the cause.
fn is_infrastructure_frame(function: &str) -> bool {
    [
        "puzzled_server::observability::",
        "std::backtrace",
        "std::panicking",
        "core::panicking",
        "rust_begin_unwind",
        "__rust_",
    ]
    .iter()
    .any(|p| function.contains(p))
}

/// Frames of a `Backtrace` display, innermost first.
fn parse_backtrace(text: &str) -> Vec<StackFrame> {
    let mut frames: Vec<StackFrame> = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if let Some(location) = line.strip_prefix("at ") {
            if let Some(frame) = frames.last_mut() {
                let (file, line, column) = split_location(location);
                frame.app_frame = is_app_path(&file);
                frame.file_path = file;
                frame.line = line;
                frame.column = column;
            }
        } else if let Some((index, function)) = line.split_once(": ") {
            if !index.is_empty() && index.bytes().all(|b| b.is_ascii_digit()) {
                let mut frame = StackFrame::default();
                frame.function_name = function.to_owned();
                frames.push(frame);
            }
        }
    }
    frames.retain(|f| !is_infrastructure_frame(&f.function_name));
    frames
}

/// The scrubbed error event for one occurrence.
pub fn error_event(report: &ErrorReport, config: &Config) -> ErrorEvent {
    let mut event = ErrorEvent::default();
    event.exception_type = report.exception_type.clone();
    event.message = scrub(
        &report
            .message
            .chars()
            .take(MAX_MESSAGE_CHARS)
            .collect::<String>(),
    );
    event.service_name = config.service.clone();
    event.release = config.release.clone();
    for (key, value) in report.tags.iter().take(60) {
        event.tags.insert(key.clone(), scrub(value));
    }
    if let Some(environment) = &config.environment {
        event
            .tags
            .insert("environment".to_owned(), environment.clone());
    }
    if let Some(route) = &report.route {
        let route = route.split(['?', '#']).next().unwrap_or_default();
        event.tags.insert("route".to_owned(), scrub(route));
        // Group 5xx responses by route and status, not by the message.
        event.fingerprint = format!("{}\n{route}", report.exception_type);
    }

    // Innermost first while building, innermost last on the wire.
    let mut frames = report
        .backtrace
        .as_deref()
        .map(parse_backtrace)
        .unwrap_or_default();
    if let Some(file) = &report.file {
        let line = report
            .line
            .map_or(0, |l| i32::try_from(l).unwrap_or(i32::MAX));
        let known = frames.iter().any(|f| {
            f.line == line
                && !f.file_path.is_empty()
                && (f.file_path.ends_with(file.as_str()) || file.ends_with(&f.file_path))
        });
        if !known {
            let mut frame = StackFrame::default();
            frame.file_path = file.clone();
            frame.line = line;
            frame.app_frame = is_app_path(file);
            frames.insert(0, frame);
        }
    }
    frames.truncate(MAX_FRAMES);
    frames.reverse();
    for frame in &mut frames {
        frame.file_path = scrub(&frame.file_path);
        frame.function_name = scrub(&frame.function_name);
    }
    event.stack_frames = frames;
    event
}

/// Message with digit runs collapsed, so ids and counts do not split a group.
fn message_shape(message: &str) -> String {
    let mut out = String::new();
    let mut in_digits = false;
    for c in message.chars() {
        if c.is_ascii_digit() {
            if !in_digits {
                out.push('#');
            }
            in_digits = true;
        } else {
            in_digits = false;
            out.push(c);
        }
    }
    out
}

/// The event's own fingerprint, else its type plus the top app frame (or the
/// message shape when there is none).
fn fingerprint_key(event: &ErrorEvent) -> String {
    if !event.fingerprint.is_empty() {
        return event.fingerprint.clone();
    }
    match event.stack_frames.iter().rev().find(|f| f.app_frame) {
        Some(frame) => format!(
            "{}\n{}:{}:{}",
            event.exception_type, frame.file_path, frame.line, frame.function_name
        ),
        None => format!(
            "{}\n{}",
            event.exception_type,
            message_shape(&event.message)
        ),
    }
}

// --------------------------------------------------------------- rate limit

/// Lets one fingerprint through once per window. The clock is a parameter so
/// tests can tick it.
#[derive(Debug)]
pub struct RateLimiter {
    window: Duration,
    seen: HashMap<u64, Instant>,
}

impl RateLimiter {
    pub fn new(window: Duration) -> Self {
        Self {
            window,
            seen: HashMap::new(),
        }
    }

    /// True when the fingerprint may be sent at `now`.
    pub fn allow(&mut self, fingerprint: &str, now: Instant) -> bool {
        let mut hasher = DefaultHasher::new();
        fingerprint.hash(&mut hasher);
        let key = hasher.finish();
        if let Some(last) = self.seen.get(&key) {
            if now.saturating_duration_since(*last) < self.window {
                return false;
            }
        }
        if self.seen.len() >= MAX_LIMITER_ENTRIES {
            let window = self.window;
            self.seen
                .retain(|_, last| now.saturating_duration_since(*last) < window);
        }
        self.seen.insert(key, now);
        true
    }

    pub fn len(&self) -> usize {
        self.seen.len()
    }

    pub fn is_empty(&self) -> bool {
        self.seen.is_empty()
    }
}

// ----------------------------------------------------------------- reporter

/// Builds, scrubs and rate-limits events and queues them for the worker.
/// Not global: [`init`] stores one in a `OnceLock`, tests build their own.
#[derive(Debug)]
pub struct Reporter {
    config: Config,
    limiter: Mutex<RateLimiter>,
    queue: Option<mpsc::Sender<CaptureErrorRequest>>,
    dropped: AtomicU64,
    suppressed: AtomicU64,
}

impl Reporter {
    /// A reporter that only logs (no key).
    pub fn log_only(config: Config) -> Self {
        Self {
            config,
            limiter: Mutex::new(RateLimiter::new(RATE_WINDOW)),
            queue: None,
            dropped: AtomicU64::new(0),
            suppressed: AtomicU64::new(0),
        }
    }

    /// A reporter with a bounded queue; drain the receiver with [`run_worker`].
    pub fn with_queue(
        config: Config,
        capacity: usize,
    ) -> (Self, mpsc::Receiver<CaptureErrorRequest>) {
        let (tx, rx) = mpsc::channel(capacity);
        let mut reporter = Self::log_only(config);
        reporter.queue = Some(tx);
        (reporter, rx)
    }

    /// Events dropped because the queue was full.
    pub fn dropped_count(&self) -> u64 {
        self.dropped.load(Ordering::Relaxed)
    }

    /// Events skipped by the per-fingerprint rate limit.
    pub fn suppressed_count(&self) -> u64 {
        self.suppressed.load(Ordering::Relaxed)
    }

    /// Reports one error now. Never blocks, never fails; callable from any thread.
    pub fn report(&self, report: &ErrorReport) {
        self.report_at(report, Instant::now());
    }

    /// [`Self::report`] with an explicit clock.
    pub fn report_at(&self, report: &ErrorReport, now: Instant) {
        let event = error_event(report, &self.config);
        tracing::error!(
            exception_type = %event.exception_type,
            route = ?report.route,
            "{}",
            event.message
        );
        let Some(queue) = &self.queue else { return };
        let allowed = self
            .limiter
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .allow(&fingerprint_key(&event), now);
        if !allowed {
            let total = self.suppressed.fetch_add(1, Ordering::Relaxed) + 1;
            tracing::debug!(suppressed = total, "observability capture rate limited");
            return;
        }
        let mut request = CaptureErrorRequest::default();
        request.parent = PARENT.to_owned();
        request.error_event = Some(event);
        if queue.try_send(request).is_err() {
            let total = self.dropped.fetch_add(1, Ordering::Relaxed) + 1;
            tracing::warn!(
                dropped = total,
                "observability queue full or closed; event dropped"
            );
        }
    }
}

/// Sends queued events one at a time until every sender is gone.
pub async fn run_worker(client: sylphx::Client, mut queue: mpsc::Receiver<CaptureErrorRequest>) {
    while let Some(request) = queue.recv().await {
        let observability = client.observability();
        let groups = observability.error_groups();
        let call = groups.capture(request);
        match tokio::time::timeout(TIMEOUT + Duration::from_secs(1), call).await {
            Ok(Ok(_)) => {}
            Ok(Err(error)) => tracing::warn!(%error, "observability capture failed"),
            Err(_) => tracing::warn!("observability capture timed out"),
        }
    }
}

/// An SDK client for `key`; `base_url` defaults to api.sylphx.com.
pub fn client(key: &str, base_url: Option<&str>) -> Option<sylphx::Client> {
    let mut builder = sylphx::HttpTransport::builder()
        .api_key(key)
        .timeout(TIMEOUT)
        .max_retries(1);
    if let Some(url) = base_url {
        builder = builder.base_url(url);
    }
    builder
        .build()
        .map(sylphx::Client::new)
        .map_err(|error| tracing::warn!(%error, "observability client not built"))
        .ok()
}

// ------------------------------------------------------------------- global

static REPORTER: OnceLock<Reporter> = OnceLock::new();

fn env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
}

/// Reads the platform environment, starts the worker and installs the panic
/// hook. Call once at startup, inside the tokio runtime.
pub fn init() {
    let config = Config {
        service: env("SYLPHX_SERVICE_NAME").unwrap_or_else(|| "api".to_owned()),
        release: env("SYLPHX_GIT_COMMIT_SHA").unwrap_or_default(),
        environment: env("SYLPHX_ENVIRONMENT_TYPE"),
    };
    let client = env("SYLPHX_API_KEY").and_then(|key| client(&key, None));
    let reporter = match (client, tokio::runtime::Handle::try_current()) {
        (Some(client), Ok(runtime)) => {
            let (reporter, queue) = Reporter::with_queue(config, QUEUE_CAPACITY);
            runtime.spawn(run_worker(client, queue));
            reporter
        }
        _ => {
            tracing::warn!("observability capture off: SYLPHX_API_KEY is not set");
            Reporter::log_only(config)
        }
    };
    if REPORTER.set(reporter).is_err() {
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
        capture(&ErrorReport {
            exception_type: "panic".to_owned(),
            message,
            file: info.location().map(|l| l.file().to_owned()),
            line: info.location().map(|l| l.line()),
            backtrace: Some(std::backtrace::Backtrace::force_capture().to_string()),
            ..ErrorReport::default()
        });
        previous(info);
    }));
}

/// Captures one error through the global reporter. Never blocks, never fails.
pub fn capture(report: &ErrorReport) {
    if let Some(reporter) = REPORTER.get() {
        reporter.report(report);
    }
}

/// Axum middleware: captures every 5xx response (route template and status only).
pub async fn capture_server_errors(request: Request, next: Next) -> Response {
    observe(REPORTER.get(), request, next).await
}

async fn observe(reporter: Option<&Reporter>, request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map_or(UNMATCHED_ROUTE, |p| {
            p.as_str()
                .split(['?', '#'])
                .next()
                .unwrap_or(UNMATCHED_ROUTE)
        })
        .to_owned();
    let response = next.run(request).await;
    let status = response.status();
    if status.is_server_error() {
        if let Some(reporter) = reporter {
            reporter.report(&ErrorReport {
                exception_type: format!("HTTP {}", status.as_u16()),
                message: format!("{method} {route} returned {status}"),
                route: Some(route),
                tags: vec![("status".to_owned(), status.as_u16().to_string())],
                ..ErrorReport::default()
            });
        }
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    use axum::http::StatusCode;
    use axum::routing::get;
    use axum::Router;
    use tower::ServiceExt as _;

    fn config() -> Config {
        Config {
            service: "api".into(),
            release: "abc123".into(),
            environment: Some("production".into()),
        }
    }

    fn report(kind: &str, message: &str) -> ErrorReport {
        ErrorReport {
            exception_type: kind.into(),
            message: message.into(),
            ..ErrorReport::default()
        }
    }

    // (a) payload

    #[test]
    fn payload_carries_service_release_environment_route_kind_message_and_stack() {
        let backtrace = "   0: std::backtrace::Backtrace::force_capture\n             at /rustc/abc/library/std/src/backtrace.rs:1:1\n   1: puzzled_server::capabilities::jobs::run\n             at ./crates/puzzled-server/src/capabilities/jobs.rs:42:9\n   2: tokio::runtime::task::run\n             at /home/u/.cargo/registry/src/index.crates.io-1/tokio-1/src/task.rs:7:3\n";
        let mut r = report("panic", "boom at /x");
        r.route = Some("/jobs/{id}?x=1".into());
        r.file = Some("crates/puzzled-server/src/capabilities/jobs.rs".into());
        r.line = Some(42);
        r.backtrace = Some(backtrace.into());
        let event = error_event(&r, &config());
        assert_eq!(event.service_name, "api");
        assert_eq!(event.release, "abc123");
        assert_eq!(event.exception_type, "panic");
        assert_eq!(event.message, "boom at /x");
        assert_eq!(
            event.tags.get("environment").map(String::as_str),
            Some("production")
        );
        assert_eq!(
            event.tags.get("route").map(String::as_str),
            Some("/jobs/{id}")
        );
        // Infrastructure frame dropped; innermost last; location not duplicated.
        assert_eq!(event.stack_frames.len(), 2);
        let last = &event.stack_frames[1];
        assert_eq!(
            last.function_name,
            "puzzled_server::capabilities::jobs::run"
        );
        assert_eq!(last.line, 42);
        assert!(last.app_frame);
        assert!(!event.stack_frames[0].app_frame);
    }

    #[test]
    fn panic_location_is_kept_when_the_backtrace_has_no_symbols() {
        let mut r = report("panic", "boom");
        r.file = Some("crates/app/src/main.rs".into());
        r.line = Some(12);
        let event = error_event(&r, &config());
        assert_eq!(event.stack_frames.len(), 1);
        assert!(event.stack_frames[0].app_frame);
        assert_eq!(event.stack_frames[0].line, 12);
        assert!(event.fingerprint.is_empty());
    }

    #[test]
    fn server_errors_group_by_route_and_status() {
        let mut a = report("HTTP 500", "POST /jobs/{id} returned 500");
        a.route = Some("/jobs/{id}".into());
        let mut c = a.clone();
        c.exception_type = "HTTP 502".into();
        assert_eq!(
            error_event(&a, &config()).fingerprint,
            "HTTP 500\n/jobs/{id}"
        );
        assert_ne!(
            error_event(&a, &config()).fingerprint,
            error_event(&c, &config()).fingerprint
        );
    }

    #[test]
    fn frames_are_capped() {
        let mut backtrace = String::new();
        for i in 0..120 {
            backtrace.push_str(&format!(
                "  {i}: app::f{i}\n             at ./src/a.rs:{i}:1\n"
            ));
        }
        let mut r = report("panic", "x");
        r.backtrace = Some(backtrace);
        assert_eq!(error_event(&r, &config()).stack_frames.len(), MAX_FRAMES);
    }

    // (b) scrubbing

    #[test]
    fn scrub_removes_each_secret_class() {
        let cases = [
            ("mail ada@example.com now", "ada@example.com"),
            (
                "Authorization: Bearer abc123def456ghi789",
                "abc123def456ghi789",
            ),
            ("got Bearer zzzzzzzzzzzz1234", "zzzzzzzzzzzz1234"),
            (
                "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefSIG123 end",
                "eyJhbGciOiJIUzI1NiJ9",
            ),
            (
                "key sylphx_sk_live_abcdef123456 used",
                "sylphx_sk_live_abcdef123456",
            ),
            ("key sk_live_abcdef123456 used", "sk_live_abcdef123456"),
            ("key pk_test_abcdef123456 used", "pk_test_abcdef123456"),
            (
                "token ghp_abcdefghijklmnop1234 used",
                "ghp_abcdefghijklmnop1234",
            ),
            ("password=hunter2 next", "hunter2"),
            (r#"{"client_secret":"s3cr3t-value","ok":1}"#, "s3cr3t-value"),
            ("cookie: session=abcdef", "abcdef"),
            (
                "id 0123456789abcdef0123456789abcdef01 end",
                "0123456789abcdef0123456789abcdef01",
            ),
            ("card 4111 1111 1111 1111 declined", "4111 1111 1111 1111"),
            ("card 4111111111111111 declined", "4111111111111111"),
        ];
        for (input, secret) in cases {
            let out = scrub(input);
            assert!(!out.contains(secret), "{input:?} -> {out:?}");
            assert!(out.contains("[redacted]"), "{input:?} -> {out:?}");
        }
    }

    #[test]
    fn scrub_leaves_ordinary_text() {
        for text in [
            "POST /jobs/{id} returned 500 Internal Server Error",
            "puzzled_server::capabilities::daily_pipeline::run_tick failed after 3 tries",
            "crates/puzzled-server/src/capabilities/daily_pipeline/mod.rs:208",
            "connection refused (os error 111) at 12:30:05",
            "Key::new panicked on empty grid, size 9",
        ] {
            assert_eq!(scrub(text), text);
        }
    }

    #[test]
    fn scrub_reaches_message_tags_and_stack() {
        let mut r = report("HTTP 500", "failed for ada@example.com");
        r.tags = vec![("user".into(), "ada@example.com".into())];
        r.backtrace = Some("  0: app::f\n     at /srv/ada@example.com/a.rs:1:1\n".into());
        let event = error_event(&r, &config());
        assert!(!event.message.contains('@'));
        assert!(event.tags.values().all(|v| !v.contains('@')));
        assert!(event
            .stack_frames
            .iter()
            .all(|f| !f.file_path.contains('@')));
    }

    // (d) rate limit

    #[test]
    fn rate_limit_allows_one_per_fingerprint_per_window() {
        let mut limiter = RateLimiter::new(RATE_WINDOW);
        let t0 = Instant::now();
        assert!(limiter.allow("a", t0));
        assert!(!limiter.allow("a", t0 + Duration::from_secs(9)));
        assert!(limiter.allow("b", t0 + Duration::from_secs(9)));
        assert!(limiter.allow("a", t0 + Duration::from_secs(11)));
    }

    #[test]
    fn rate_limit_prunes_stale_entries() {
        let mut limiter = RateLimiter::new(RATE_WINDOW);
        let t0 = Instant::now();
        for i in 0..MAX_LIMITER_ENTRIES {
            assert!(limiter.allow(&i.to_string(), t0));
        }
        assert!(limiter.allow("fresh", t0 + Duration::from_secs(11)));
        assert_eq!(limiter.len(), 1);
    }

    #[test]
    fn reporter_suppresses_repeats_until_the_window_passes() {
        let (reporter, mut rx) = Reporter::with_queue(config(), 8);
        let t0 = Instant::now();
        let same = report("HTTP 500", "GET /a returned 500");
        reporter.report_at(&same, t0);
        reporter.report_at(&same, t0 + Duration::from_secs(5));
        assert_eq!(reporter.suppressed_count(), 1);
        reporter.report_at(&report("panic", "other"), t0 + Duration::from_secs(5));
        reporter.report_at(&same, t0 + Duration::from_secs(10));
        assert_eq!(reporter.suppressed_count(), 1);
        let mut sent = 0;
        while rx.try_recv().is_ok() {
            sent += 1;
        }
        assert_eq!(sent, 3);
    }

    // (e) bounded queue

    #[test]
    fn full_queue_drops_without_blocking() {
        let (reporter, _rx) = Reporter::with_queue(config(), 2);
        for i in 0..5 {
            reporter.report(&report(&format!("kind{i}"), "x"));
        }
        assert_eq!(reporter.dropped_count(), 3);
    }

    // (c) middleware against a fake ingest server

    #[derive(Clone, Default)]
    struct Fake(Arc<Mutex<Vec<String>>>);

    impl Fake {
        fn bodies(&self) -> Vec<String> {
            self.0
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .clone()
        }
    }

    async fn fake_server() -> (Fake, String) {
        let fake = Fake::default();
        let state = fake.clone();
        let app = Router::new().fallback(move |body: axum::body::Bytes| {
            let state = state.clone();
            async move {
                state
                    .0
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .push(String::from_utf8_lossy(&body).into_owned());
                axum::Json(serde_json::json!({}))
            }
        });
        let listener = match tokio::net::TcpListener::bind("127.0.0.1:0").await {
            Ok(l) => l,
            Err(error) => panic!("bind fake server: {error}"),
        };
        let url = match listener.local_addr() {
            Ok(addr) => format!("http://{addr}"),
            Err(error) => panic!("fake server address: {error}"),
        };
        tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        (fake, url)
    }

    async fn get_status(app: &Router, path: &str) -> StatusCode {
        let request = match axum::http::Request::builder()
            .uri(path)
            .body(axum::body::Body::empty())
        {
            Ok(r) => r,
            Err(error) => panic!("request: {error}"),
        };
        match app.clone().oneshot(request).await {
            Ok(response) => response.status(),
            Err(error) => panic!("oneshot: {error}"),
        }
    }

    #[tokio::test]
    async fn a_500_sends_exactly_one_event_and_a_200_sends_none() {
        let (fake, url) = fake_server().await;
        let Some(client) = client("sylphx_sk_test_key", Some(&url)) else {
            panic!("client not built");
        };
        let (reporter, queue) = Reporter::with_queue(config(), QUEUE_CAPACITY);
        tokio::spawn(run_worker(client, queue));
        let reporter = Arc::new(reporter);
        let app = Router::new()
            .route(
                "/boom/{id}",
                get(|| async { StatusCode::INTERNAL_SERVER_ERROR }),
            )
            .route("/ok", get(|| async { "ok" }))
            .layer(axum::middleware::from_fn(
                move |request: Request, next: Next| {
                    let reporter = Arc::clone(&reporter);
                    async move { observe(Some(&reporter), request, next).await }
                },
            ));

        assert_eq!(get_status(&app, "/ok").await, StatusCode::OK);
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert!(fake.bodies().is_empty());

        assert_eq!(
            get_status(&app, "/boom/7?token=abc").await,
            StatusCode::INTERNAL_SERVER_ERROR
        );
        for _ in 0..100 {
            if !fake.bodies().is_empty() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
        let bodies = fake.bodies();
        assert_eq!(bodies.len(), 1, "{bodies:?}");
        assert!(bodies[0].contains("/boom/{id}"), "{}", bodies[0]);
        assert!(bodies[0].contains("abc123"), "{}", bodies[0]);
        assert!(!bodies[0].contains("/boom/7"), "{}", bodies[0]);
    }

    #[tokio::test]
    async fn unmatched_routes_use_the_placeholder() {
        let (reporter, mut rx) = Reporter::with_queue(config(), 8);
        let reporter = Arc::new(reporter);
        let app = Router::new()
            .fallback(|| async { StatusCode::BAD_GATEWAY })
            .layer(axum::middleware::from_fn(
                move |request: Request, next: Next| {
                    let reporter = Arc::clone(&reporter);
                    async move { observe(Some(&reporter), request, next).await }
                },
            ));
        assert_eq!(
            get_status(&app, "/secret/123?x=1").await,
            StatusCode::BAD_GATEWAY
        );
        let Ok(sent) = rx.try_recv() else {
            panic!("no event queued");
        };
        let Some(event) = sent.error_event else {
            panic!("no event");
        };
        assert_eq!(
            event.tags.get("route").map(String::as_str),
            Some(UNMATCHED_ROUTE)
        );
        assert!(!event.message.contains("/secret"));
    }
}
