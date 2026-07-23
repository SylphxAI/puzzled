//! Known platform job names and residual classification (ADR-169).

/// Known platform cron / job names (parity: JOB_HANDLERS keys).
pub const JOB_GENERATE_DAILY_PUZZLES: &str = "generate-daily-puzzles";
pub const JOB_DLQ_RETRY: &str = "dlq-retry";
pub const JOB_DAILY_REMINDER: &str = "daily-reminder";
pub const JOB_STREAK_AT_RISK: &str = "streak-at-risk";
pub const JOB_WIN_BACK_EMAILS: &str = "win-back-emails";

/// Seed-based games with Rust pure generators available.
pub const RUST_SEED_GAMES: &[&str] = &["sudoku"];

/// Games that still require LLM pre-generation (web residual).
pub const LLM_GAMES: &[&str] = &["word-groups", "crossword", "cryptogram"];

/// Jobs whose full product effect still requires web residual I/O.
#[must_use]
pub fn is_residual_io_job(cron_name: &str) -> bool {
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
