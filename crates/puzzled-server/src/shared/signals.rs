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

/// The nonce subject of an induced failure, consumed by the same observer
/// that reports ordinary failures so one request produces one issue line.
#[derive(Clone)]
pub(crate) struct IssueSubject(pub String);

/// User intent, not the HTTP verb: Connect reads also use POST. Operator,
/// job, bootstrap and induction routes are not user-write journeys.
fn is_user_write(path: &str) -> bool {
    matches!(
        path,
        "/puzzled.v1.PuzzleService/SubmitGuess"
            | "/puzzled.v1.PuzzleService/ShareResult"
            | "/puzzled.v1.PreferencesService/SaveWebPushSubscription"
            | "/puzzled.v1.PreferencesService/UpdateProfile"
            | "/puzzled.v1.PreferencesService/UpdatePushPreferences"
            | "/puzzled.v1.PreferencesService/UpdateEmailPreferences"
            | "/puzzled.v1.PreferencesService/UnsubscribeEmail"
            | "/puzzled.v1.PreferencesService/DeleteAccountData"
            | "/puzzled.v1.PreferencesService/RecordSignupAttribution"
            | "/puzzled.v1.BillingService/CreateCheckout"
            | "/puzzled.v1.BillingService/CreatePortal"
            | "/puzzled.v1.BillingService/CancelSubscription"
            | "/puzzled.v1.BillingService/ResumeSubscription"
            | "/puzzled.v1.BillingService/JoinFamily"
            | "/puzzled.v1.BillingService/LeaveFamily"
            | "/puzzled.v1.BillingService/RemoveFamilyMember"
            | "/puzzled.v1.BillingService/ResetFamilyInvite"
            | "/puzzled.v1.GamificationService/ToggleAutoFreeze"
            | "/puzzled.v1.GamificationService/TryAutoFreeze"
            | "/puzzled.v1.GamificationService/AddStreakFreezes"
    )
}

/// One availability outcome per finished user-mutating RPC. Client
/// rejections are not server failures; only HTTP 5xx fails the journey.
/// URI matching works for Connect fallback services without MatchedPath.
pub async fn observe(req: Request, next: Next) -> Response {
    let write = req.method() == Method::POST && is_user_write(req.uri().path());
    let subject = req
        .extensions()
        .get::<MatchedPath>()
        .map(|p| route_subject(p.as_str()))
        .unwrap_or_default();
    let r = next.run(req).await;
    let status = r.status().as_u16();
    let failed = status >= 500;
    if failed {
        let subject = r
            .extensions()
            .get::<IssueSubject>()
            .map(|s| s.0.as_str())
            .unwrap_or(&subject);
        issue(Kind::TurnFailed, subject, &status.to_string());
    }
    if write {
        let event = if failed {
            "puzzled.user.write.failed"
        } else {
            "puzzled.user.write.ok"
        };
        tracing::info!(event, severity = "info", release = release(), "journey");
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
    async fn failed_requests_report_one_fingerprint_without_counting_bootstrap_as_user_write() {
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
            .route(
                "/puzzled.v1.PuzzleService/ShareResult",
                post(|| async { "ok" }),
            )
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
            .oneshot(call("POST", "/puzzled.v1.PuzzleService/ShareResult"))
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
                "puzzled.issue.turn_failed.v1_guest_session",
                "puzzled.user.write.ok",
                "puzzled.issue.turn_failed.v1_boom",
            ],
            "{out}"
        );
        assert!(
            out.lines().all(|l| l.contains("severity=\"info\"")),
            "{out}"
        );
    }

    #[tokio::test(flavor = "current_thread")]
    async fn failed_submissions_are_not_diluted_by_successful_connect_reads() {
        use axum::http::StatusCode;
        use axum::routing::post;
        use tower::ServiceExt;

        let cap = Capture::default();
        let w = cap.clone();
        let sub = tracing_subscriber::fmt()
            .with_ansi(false)
            .with_writer(move || w.clone())
            .finish();
        let _g = tracing::subscriber::set_default(sub);
        // Connect services are the fallback, not matched Axum routes.
        let app = axum::Router::new()
            .fallback_service(post(|req: Request| async move {
                if req.uri().path() == "/puzzled.v1.PuzzleService/SubmitGuess" {
                    StatusCode::SERVICE_UNAVAILABLE
                } else {
                    StatusCode::OK
                }
            }))
            .layer(axum::middleware::from_fn(observe));
        for (path, count) in [
            ("/puzzled.v1.PuzzleService/SubmitGuess", 10),
            ("/puzzled.v1.PuzzleService/GetDaily", 1_000),
        ] {
            for _ in 0..count {
                let req = axum::http::Request::builder()
                    .method("POST")
                    .uri(path)
                    .body(axum::body::Body::empty())
                    .unwrap();
                app.clone().oneshot(req).await.unwrap();
            }
        }
        let out = String::from_utf8(cap.0.lock().unwrap().clone()).unwrap();
        let writes = out
            .lines()
            .filter(|l| l.contains("puzzled.user.write."))
            .count();
        let failed = out
            .lines()
            .filter(|l| l.contains("puzzled.user.write.failed"))
            .count();
        assert_eq!((writes, failed), (10, 10), "{out}");
        assert_eq!(failed as f64 / writes as f64, 1.0);
        assert!(!out.contains("puzzled.api.write."));
    }
}
