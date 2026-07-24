//! Known platform job names and terminal ownership (ADR-170).

/// Known platform cron / job names (parity: JOB_HANDLERS keys).
pub const JOB_GENERATE_DAILY_PUZZLES: &str = "generate-daily-puzzles";
pub const JOB_DLQ_RETRY: &str = "dlq-retry";
pub const JOB_DAILY_REMINDER: &str = "daily-reminder";
pub const JOB_STREAK_AT_RISK: &str = "streak-at-risk";
pub const JOB_WIN_BACK_EMAILS: &str = "win-back-emails";

/// Seed-based games with Rust pure generators available.
pub const RUST_SEED_GAMES: &[&str] = &["sudoku"];

/// Games that require LLM pre-generation in the web job worker.
pub const LLM_GAMES: &[&str] = &["word-groups", "crossword", "cryptogram"];

/// Jobs whose full product effects are owned by the web platform job worker
/// (ADR-170 terminal ownership — not a temporary residual).
#[must_use]
pub fn is_web_worker_job(cron_name: &str) -> bool {
    matches!(
        cron_name,
        JOB_DLQ_RETRY
            | JOB_DAILY_REMINDER
            | JOB_STREAK_AT_RISK
            | JOB_WIN_BACK_EMAILS
            | JOB_GENERATE_DAILY_PUZZLES
    )
}

/// Alias retained for callers during rename; prefer [`is_web_worker_job`].
#[must_use]
pub fn is_residual_io_job(cron_name: &str) -> bool {
    // generate-daily is also web-worker owned for full effects (LLM + DB).
    // Rust seed materialize remains available separately via plan/execute pure path.
    matches!(
        cron_name,
        JOB_DLQ_RETRY | JOB_DAILY_REMINDER | JOB_STREAK_AT_RISK | JOB_WIN_BACK_EMAILS
    )
}

/// True when the name is a registered platform job.
#[must_use]
pub fn is_known_job(cron_name: &str) -> bool {
    matches!(
        cron_name,
        JOB_GENERATE_DAILY_PUZZLES
            | JOB_DLQ_RETRY
            | JOB_DAILY_REMINDER
            | JOB_STREAK_AT_RISK
            | JOB_WIN_BACK_EMAILS
    )
}
