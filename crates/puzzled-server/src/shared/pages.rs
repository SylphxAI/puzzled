//! Page on-call when a must-act-now failure is sustained.
//!
//! A page is one log line carrying `event = "<name>"` and `severity = "page"`;
//! on-call routing reads it from this service's log stream. Everything else
//! stays at normal severity, so a single transient error never pages: a
//! [`FailureStreak`] counts failures in memory and pages once when the count
//! reaches its threshold, then logs `<event>_recovered` once at normal
//! severity when a success follows. Event names live in [`events`]; the
//! meaning of each and the first response are in docs/operations.md.
//!
//! `detail` is a short, stable error class (an error variant name, an HTTP
//! status class, `"timeout"`). Never pass a message, URL, token or user data.

use std::sync::{Mutex, MutexGuard, PoisonError};

/// The page event names. One place per repo; docs/operations.md is the source.
pub mod events {
    /// The daily puzzle job failed, so there is no puzzle for the day.
    pub const DAILY_GENERATION_FAILED: &str = "puzzled_daily_generation_failed";
    /// Sign-in checks cannot get an answer (Auth or the JWKS), so nobody can sign in.
    pub const SIGNIN_UNAVAILABLE: &str = "puzzled_signin_unavailable";
}

/// Sign-in is one streak for both paths (Auth session bearers and platform JWT
/// verification), so one outage is one page. Five unavailable checks in a row
/// page; the next check that gets an answer clears it. A refused token is an
/// answer, not a failure.
pub static SIGNIN_UNAVAILABLE: FailureStreak = FailureStreak::new(events::SIGNIN_UNAVAILABLE, 5);

#[derive(Debug, Default)]
struct State {
    failures: u32,
    paging: bool,
}

/// Consecutive failures of one operation, and whether it is paging.
///
/// One static per event:
/// `static DAILY: FailureStreak = FailureStreak::new(events::DAILY_GENERATION_FAILED, 1);`
#[derive(Debug)]
pub struct FailureStreak {
    event: &'static str,
    threshold: u32,
    state: Mutex<State>,
}

impl FailureStreak {
    /// `threshold` consecutive failures page once.
    #[must_use]
    pub const fn new(event: &'static str, threshold: u32) -> Self {
        Self {
            event,
            threshold,
            state: Mutex::new(State {
                failures: 0,
                paging: false,
            }),
        }
    }

    /// Records one failure; pages when the streak reaches the threshold.
    pub fn failed(&self, detail: &str) {
        let mut state = self.lock();
        state.failures = state.failures.saturating_add(1);
        if state.failures == self.threshold {
            state.paging = true;
            tracing::error!(
                event = self.event,
                severity = "page",
                detail,
                failures = state.failures,
                "{} failed {} times in a row",
                self.event,
                state.failures
            );
        }
    }

    /// Records one success: clears the streak, and closes the incident once.
    pub fn succeeded(&self) {
        let mut state = self.lock();
        state.failures = 0;
        if std::mem::take(&mut state.paging) {
            let event = format!("{}_recovered", self.event);
            tracing::info!(event = %event, severity = "info", "{} recovered", self.event);
        }
    }

    fn lock(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// Captures this thread's tracing output, for tests that assert on page lines.
#[cfg(test)]
#[allow(clippy::expect_used)]
pub(crate) mod capture {
    use std::io::Write;
    use std::sync::{Arc, Mutex};

    use tracing_subscriber::fmt::MakeWriter;

    #[derive(Clone, Default)]
    pub struct Shared(Arc<Mutex<Vec<u8>>>);

    impl Write for Shared {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.lock().expect("buffer").extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    impl<'a> MakeWriter<'a> for Shared {
        type Writer = Self;
        fn make_writer(&'a self) -> Self::Writer {
            self.clone()
        }
    }

    pub fn capture() -> (Shared, tracing::subscriber::DefaultGuard) {
        let buffer = Shared::default();
        let subscriber = tracing_subscriber::fmt()
            .with_writer(buffer.clone())
            .with_ansi(false)
            .without_time()
            .finish();
        let guard = tracing::subscriber::set_default(subscriber);
        (buffer, guard)
    }

    pub fn logged(buffer: &Shared) -> String {
        String::from_utf8(buffer.0.lock().expect("buffer").clone()).expect("utf8")
    }

    pub fn count(haystack: &str, needle: &str) -> usize {
        haystack.matches(needle).count()
    }
}

#[cfg(test)]
mod tests {
    use super::capture::{capture, count, logged};
    use super::*;

    #[test]
    fn pages_once_at_the_threshold_and_logs_recovery() {
        let (buffer, _guard) = capture();
        let streak = FailureStreak::new("widget_unavailable", 5);

        for _ in 0..4 {
            streak.failed("timeout");
        }
        assert_eq!(count(&logged(&buffer), "severity=\"page\""), 0);

        streak.failed("timeout");
        let out = logged(&buffer);
        assert_eq!(count(&out, "severity=\"page\""), 1);
        assert!(out.contains("event=\"widget_unavailable\""));
        assert!(out.contains("detail=\"timeout\""));
        assert!(out.contains("failures=5"));

        // Still failing: one page per incident.
        streak.failed("timeout");
        streak.failed("timeout");
        assert_eq!(count(&logged(&buffer), "severity=\"page\""), 1);

        streak.succeeded();
        let out = logged(&buffer);
        assert_eq!(count(&out, "widget_unavailable_recovered"), 1);
        assert_eq!(count(&out, "severity=\"page\""), 1);

        // A success after recovery stays quiet; a later streak pages again.
        streak.succeeded();
        assert_eq!(count(&logged(&buffer), "widget_unavailable_recovered"), 1);
        for _ in 0..4 {
            streak.failed("timeout");
        }
        assert_eq!(count(&logged(&buffer), "severity=\"page\""), 1);
        streak.failed("timeout");
        assert_eq!(count(&logged(&buffer), "severity=\"page\""), 2);
    }

    #[test]
    fn a_streak_below_the_threshold_never_pages_or_recovers() {
        let (buffer, _guard) = capture();
        let streak = FailureStreak::new("widget_unavailable", 5);

        for _ in 0..4 {
            streak.failed("timeout");
        }
        streak.succeeded();
        let out = logged(&buffer);
        assert_eq!(count(&out, "severity=\"page\""), 0);
        assert_eq!(count(&out, "widget_unavailable_recovered"), 0);
    }

    #[test]
    fn a_single_failure_threshold_pages_and_recovers() {
        let (buffer, _guard) = capture();
        let streak = FailureStreak::new("job_failed", 1);

        streak.failed("job_error");
        assert_eq!(count(&logged(&buffer), "severity=\"page\""), 1);
        streak.succeeded();
        assert_eq!(count(&logged(&buffer), "job_failed_recovered"), 1);
    }
}
