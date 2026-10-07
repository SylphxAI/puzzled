//! Quality signals (owner standard quality-signals, cloud ADR
//! quality-signals-to-work): Puzzled reports its own problems as one
//! structured log line each, and every finished write as a journey line.
//!
//! - `event=puzzled.issue.<kind>.<subject> severity=info`: the event name is
//!   the problem's fingerprint. The platform counts the line
//!   (`sylphx_log_events_total`), the `ProductIssueReported` rule raises one
//!   alert per fingerprint, and the desk alert intake files one work item for
//!   it (a repeat while it is open is a note; a return after it closed is a
//!   regression). `infra/runbooks/product-issues.md`.
//! - `event=puzzled.<journey>.ok|failed severity=info`: one line per finished
//!   journey, the events of the journey's SLO.
//!
//! A line carries only enumerated values: the kind, a subject taken from the
//! route or fixed in the code, and the release. Never a path with its ids, a
//! body, a key or a message.

use axum::extract::{MatchedPath, Request};
use axum::http::Method;
use axum::middleware::Next;
use axum::response::Response;

/// The product prefix of every event.
const PRODUCT: &str = "puzzled";
/// The platform counts an event name of at most this many characters
/// (`^[a-z0-9_.]{1,64}$`); anything longer or odd counts as `other`.
const MAX_EVENT: usize = 64;

/// What went wrong (the ADR's kinds a server can see by itself).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// A dependency the request or job needed failed (database, Auth, Money).
    ToolFailed,
    /// A request ended in an error the caller saw (a 5xx).
    TurnFailed,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Kind::ToolFailed => "tool_failed",
            Kind::TurnFailed => "turn_failed",
        }
    }
}

/// The fingerprint of a problem: `puzzled.issue.<kind>.<subject>`, only
/// `[a-z0-9_.]`, at most 64 characters. Anything else in `subject` becomes
/// `_`; a subject too long keeps its head and gets a short hash of the whole,
/// so two long subjects never share a name.
pub fn fingerprint(kind: Kind, subject: &str) -> String {
    let head = format!("{PRODUCT}.issue.{}.", kind.name());
    let mut s = String::with_capacity(subject.len());
    for c in subject.chars() {
        let c = c.to_ascii_lowercase();
        let c = if c.is_ascii_lowercase() || c.is_ascii_digit() {
            c
        } else {
            '_'
        };
        if !(c == '_' && (s.is_empty() || s.ends_with('_'))) {
            s.push(c);
        }
    }
    while s.ends_with('_') {
        s.pop();
    }
    if s.is_empty() {
        s.push_str("unknown");
    }
    let room = MAX_EVENT - head.len();
    if s.len() > room {
        let hash = format!("{:08x}", fnv1a(subject.as_bytes()) as u32);
        s.truncate(room - hash.len() - 1);
        s.push('_');
        s.push_str(&hash);
    }
    head + &s
}

fn fnv1a(b: &[u8]) -> u64 {
    b.iter().fold(0xcbf2_9ce4_8422_2325, |h, &x| {
        (h ^ x as u64).wrapping_mul(0x0100_0000_01b3)
    })
}

/// The subject of a route: its template with the parameters left out, so
/// `/v1/puzzles/{game}` is `v1_puzzles`. Only the route table's own text
/// enters it.
pub fn route_subject(template: &str) -> String {
    template
        .split('/')
        .filter(|seg| !seg.is_empty() && !seg.starts_with('{') && !seg.starts_with(':'))
        .collect::<Vec<_>>()
        .join("_")
}

/// The release this process runs (`SYLPHX_GIT_COMMIT_SHA`), or `-`.
fn release() -> &'static str {
    static R: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    R.get_or_init(|| {
        std::env::var("SYLPHX_GIT_COMMIT_SHA")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "-".into())
    })
}

/// Report one occurrence of a problem. `code` is an enumerated detail (an
/// HTTP status, a fixed reason name), never free text.
pub fn issue(kind: Kind, subject: &str, code: &str) {
    let event = fingerprint(kind, subject);
    tracing::info!(event = %event, severity = "info", code, release = release(), "issue");
}

/// The journey line of one finished user journey: `puzzled.<journey>.ok` or
/// `.failed`, the events of that journey's SLO.
pub fn journey(name: &str, ok: bool) {
    let event = format!("{PRODUCT}.{name}.{}", if ok { "ok" } else { "failed" });
    tracing::info!(event = %event, severity = "info", release = release(), "journey");
}

/// Axum middleware (on matched routes): a 5xx reports `turn_failed` for the
/// route; a write (any method but GET, HEAD and OPTIONS) writes the
/// `api-write` journey line. The free daily read is a GET, so only writes
/// (submits, shares, account changes) reach the journey; reads are covered by
/// the edge SLOs.
pub async fn observe(req: Request, next: Next) -> Response {
    let write = !matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS);
    let subject = req
        .extensions()
        .get::<MatchedPath>()
        .map(|p| route_subject(p.as_str()))
        .unwrap_or_default();
    let r = next.run(req).await;
    let status = r.status().as_u16();
    let failed = status >= 500;
    if failed {
        issue(Kind::TurnFailed, &subject, &status.to_string());
    }
    if write {
        journey("api.write", !failed);
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid(e: &str) -> bool {
        !e.is_empty()
            && e.len() <= MAX_EVENT
            && e.bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'.')
    }

    #[test]
    fn fingerprint_is_bounded_and_stable() {
        assert_eq!(
            fingerprint(Kind::TurnFailed, &route_subject("/v1/guest/session")),
            "puzzled.issue.turn_failed.v1_guest_session"
        );
        assert_eq!(
            fingerprint(Kind::ToolFailed, "daily_puzzle_fill"),
            "puzzled.issue.tool_failed.daily_puzzle_fill"
        );
        assert_eq!(
            fingerprint(Kind::TurnFailed, ""),
            "puzzled.issue.turn_failed.unknown"
        );
        // free text never survives as-is: case, spaces and punctuation fold
        let f = fingerprint(Kind::ToolFailed, "Bob's Email <a@b.c>!");
        assert!(valid(&f), "{f}");
        assert!(!f.contains('@') && !f.contains(' '), "{f}");
    }

    #[test]
    fn long_subjects_keep_distinct_names_within_the_limit() {
        let a = "x".repeat(100) + "a";
        let b = "x".repeat(100) + "b";
        let (fa, fb) = (
            fingerprint(Kind::ToolFailed, &a),
            fingerprint(Kind::ToolFailed, &b),
        );
        assert!(valid(&fa) && valid(&fb), "{fa} {fb}");
        assert_eq!(fa.len(), MAX_EVENT);
        assert_ne!(fa, fb);
    }

    /// The lines the middleware writes, through the same text formatter a
    /// deployment uses (Alloy reads `event=` and `severity=` from it).
    #[derive(Clone, Default)]
    struct Capture(std::sync::Arc<std::sync::Mutex<Vec<u8>>>);
    impl std::io::Write for Capture {
        fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(b);
            Ok(b.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    #[tokio::test(flavor = "current_thread")]
    async fn failed_requests_report_one_fingerprint_and_writes_their_journey() {
        use axum::http::StatusCode;
        use axum::routing::{get, post};
        use tower::ServiceExt;

        let cap = Capture::default();
        let w = cap.clone();
        let sub = tracing_subscriber::fmt()
            .with_ansi(false)
            .with_writer(move || w.clone())
            .finish();
        let _g = tracing::subscriber::set_default(sub);

        let app = axum::Router::new()
            .route(
                "/v1/guest/session",
                post(|| async { StatusCode::SERVICE_UNAVAILABLE }),
            )
            .route("/v1/puzzles/{game}/guess", post(|| async { "ok" }))
            .route("/v1/daily", get(|| async { "ok" }))
            .route(
                "/v1/boom",
                get(|| async { StatusCode::INTERNAL_SERVER_ERROR }),
            )
            .route_layer(axum::middleware::from_fn(observe));
        let call = |m: &str, p: &str| {
            axum::http::Request::builder()
                .method(m)
                .uri(p)
                .body(axum::body::Body::empty())
                .unwrap()
        };
        // the same failure twice: one fingerprint, two occurrences
        for _ in 0..2 {
            app.clone()
                .oneshot(call("POST", "/v1/guest/session"))
                .await
                .unwrap();
        }
        app.clone()
            .oneshot(call("POST", "/v1/puzzles/queens/guess"))
            .await
            .unwrap();
        app.clone().oneshot(call("GET", "/v1/daily")).await.unwrap();
        app.clone().oneshot(call("GET", "/v1/boom")).await.unwrap();

        let out = String::from_utf8(cap.0.lock().unwrap().clone()).unwrap();
        let events: Vec<&str> = out
            .lines()
            .filter_map(|l| l.split("event=").nth(1))
            .map(|r| r.split_whitespace().next().unwrap().trim_matches('"'))
            .collect();
        assert_eq!(
            events,
            [
                "puzzled.issue.turn_failed.v1_guest_session",
                "puzzled.api.write.failed",
                "puzzled.issue.turn_failed.v1_guest_session",
                "puzzled.api.write.failed",
                "puzzled.api.write.ok",
                "puzzled.issue.turn_failed.v1_boom",
            ],
            "{out}"
        );
        assert!(
            out.lines().all(|l| l.contains("severity=\"info\"")),
            "{out}"
        );
        // the path's own ids never reach a line
        assert!(!out.contains("queens"), "{out}");
    }
}
