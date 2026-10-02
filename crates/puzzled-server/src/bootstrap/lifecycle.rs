//! Process lifecycle: port binding config and graceful shutdown.

use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tokio::task::JoinHandle;
use tokio_util::task::TaskTracker;

static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

/// Every spawned task that does durable work (an account erasure, the
/// start-up puzzle fill) runs on this tracker, so a rolling deploy lets it
/// finish instead of cutting it off mid-transaction.
static DURABLE_TASKS: std::sync::LazyLock<TaskTracker> = std::sync::LazyLock::new(TaskTracker::new);

/// Longest the process waits for tracked tasks after SIGTERM. Kubernetes
/// sends SIGKILL after `terminationGracePeriodSeconds` (default 30 s, and the
/// HTTP drain runs before this wait), so the bound stays below it; an erasure
/// still running after it is logged for `erase-player`.
pub const SHUTDOWN_DRAIN_TIMEOUT: Duration = Duration::from_secs(25);

/// Spawn `future` as a durable task: it is awaited by [`drain_tasks`].
pub fn spawn_durable<F>(future: F) -> JoinHandle<F::Output>
where
    F: Future + Send + 'static,
    F::Output: Send + 'static,
{
    DURABLE_TASKS.spawn(future)
}

/// Outcome of a shutdown drain.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DrainReport {
    pub pending: usize,
    pub drained: usize,
    pub timed_out: bool,
}

/// Close `tracker` and wait for its tasks for at most `timeout`; logs
/// `shutdown_drain {pending, drained, timed_out}`.
pub async fn drain(tracker: &TaskTracker, timeout: Duration) -> DrainReport {
    tracker.close();
    let pending = tracker.len();
    let timed_out = tokio::time::timeout(timeout, tracker.wait()).await.is_err();
    let remaining = if timed_out { tracker.len() } else { 0 };
    let report = DrainReport {
        pending,
        drained: pending.saturating_sub(remaining),
        timed_out,
    };
    if timed_out {
        tracing::warn!(
            pending = report.pending,
            drained = report.drained,
            timed_out = report.timed_out,
            "shutdown_drain"
        );
    } else {
        tracing::info!(
            pending = report.pending,
            drained = report.drained,
            timed_out = report.timed_out,
            "shutdown_drain"
        );
    }
    report
}

/// Drain the process-wide durable tasks; call after the HTTP server stopped.
pub async fn drain_tasks() -> DrainReport {
    drain(&DURABLE_TASKS, SHUTDOWN_DRAIN_TIMEOUT).await
}

pub fn request_shutdown() {
    SHUTTING_DOWN.store(true, Ordering::Relaxed);
}

#[must_use]
pub(crate) fn shutting_down() -> bool {
    SHUTTING_DOWN.load(Ordering::Relaxed)
}

#[must_use]
pub fn http_port() -> u16 {
    std::env::var("PUZZLED_HTTP_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8080)
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(error) => tracing::error!(%error, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => tracing::info!("shutdown signal received: SIGINT"),
        () = terminate => tracing::info!("shutdown signal received: SIGTERM"),
    }

    request_shutdown();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[tokio::test]
    async fn a_tracked_task_completes_before_drain_returns() {
        let tracker = TaskTracker::new();
        let done = Arc::new(AtomicBool::new(false));
        let flag = done.clone();
        tracker.spawn(async move {
            tokio::time::sleep(Duration::from_millis(150)).await;
            flag.store(true, Ordering::SeqCst);
        });
        let report = drain(&tracker, Duration::from_secs(5)).await;
        assert!(done.load(Ordering::SeqCst), "task must finish first");
        assert_eq!(
            report,
            DrainReport {
                pending: 1,
                drained: 1,
                timed_out: false
            }
        );
    }

    #[tokio::test]
    async fn a_stuck_task_times_out_the_drain() {
        let tracker = TaskTracker::new();
        tracker.spawn(std::future::pending::<()>());
        let report = drain(&tracker, Duration::from_millis(50)).await;
        assert!(report.timed_out);
        assert_eq!((report.pending, report.drained), (1, 0));
    }
}
