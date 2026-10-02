//! `puzzled-server erase-player --subject <auth subject> [--dry-run]`: the
//! operator's erasure of one person, by the Sylphx Auth subject they signed in
//! with. It is the supported recovery for an in-app erasure whose sign-in was
//! deleted but whose rows were not committed (the person can no longer sign in
//! to retry), and the path for an erasure asked for outside the app.
//!
//! It runs the same `erase_player` as `DeleteAccountData`: the Money rule,
//! then the rows and Auth's deletion in one transaction. Safe to repeat: a
//! second run deletes nothing and Auth answers the same request (fixed
//! idempotency key) or that it holds no such account.
//!
//! Run in the api's own environment (`[[jobs]] erase-player` in
//! `sylphx.toml`), so it uses the api's database, Money and Auth bindings.
//! Output: one JSON line of counts. No subject, player id, request id or
//! email is printed or logged by this command or the erase path it runs.
//!
//! Platform note: Auth's `auth.user.deletion_requested` delivery to a
//! registered `[privacy]` erasure handler (cloud `docs/specs/one-platform/
//! end-user-principal.md` §9) is specified but not served yet. When it is,
//! its handler calls `account_deletion::delete_account_data` keyed by the
//! delivered `user_id` through `auth_subjects::known_player`, and this command
//! stays the manual path.

use std::io::Write;

use serde::Serialize;
use sqlx::PgPool;

use crate::capabilities::identity_access::adapters::auth_erasure::{AuthErasure, AuthError};
use crate::capabilities::identity_access::adapters::auth_subjects;
use crate::capabilities::money::Money;
use crate::capabilities::preferences::adapters::account_deletion::{
    count_account_data, erase_player, EraseError,
};

/// Exit codes the job reports.
pub mod exit {
    pub const OK: i32 = 0;
    pub const USAGE: i32 = 2;
    /// Money says a subscription still renews, or cannot answer.
    pub const MONEY: i32 = 3;
    pub const DATABASE: i32 = 4;
    /// A required binding (database URL, Auth key) is missing.
    pub const CONFIG: i32 = 5;
    /// Auth refused or did not confirm; no row was erased (the sign-in may be
    /// deleted when the outcome says `sign_in_unconfirmed`; run it again).
    pub const AUTH: i32 = 6;
}

#[derive(Debug, PartialEq, Eq)]
pub struct Command {
    pub subject: String,
    pub dry_run: bool,
}

pub fn parse(args: &[String]) -> Result<Command, String> {
    let mut subject = None;
    let mut dry_run = false;
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--subject" => {
                subject = rest
                    .next()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                if subject.is_none() {
                    return Err("--subject needs a value".into());
                }
            }
            "--dry-run" => dry_run = true,
            other => return Err(format!("unknown argument {other:?}")),
        }
    }
    let subject = subject.ok_or("usage: erase-player --subject <auth subject> [--dry-run]")?;
    Ok(Command { subject, dry_run })
}

/// Counts only: never a subject, player id or email.
#[derive(Debug, Default, Serialize, PartialEq, Eq)]
pub struct Report {
    pub dry_run: bool,
    pub player_found: bool,
    pub rows_deleted: u64,
    pub rows_found: u64,
    pub subjects_filed: usize,
    pub subjects_absent: usize,
    pub attempts: usize,
    pub outcome: &'static str,
}

/// Run one command against the bindings given. Returns the exit code.
pub async fn run(
    command: &Command,
    pool: &PgPool,
    money: Option<&Money>,
    auth: Option<&AuthErasure>,
    out: &mut impl Write,
) -> i32 {
    let mut report = Report {
        dry_run: command.dry_run,
        ..Report::default()
    };
    let code = run_inner(command, pool, money, auth, &mut report).await;
    let _ = writeln!(
        out,
        "{}",
        serde_json::to_string(&report).unwrap_or_default()
    );
    code
}

async fn run_inner(
    command: &Command,
    pool: &PgPool,
    money: Option<&Money>,
    auth: Option<&AuthErasure>,
    report: &mut Report,
) -> i32 {
    let player = match auth_subjects::known_player(pool, &command.subject).await {
        Ok(player) => player,
        Err(error) => {
            tracing::error!(%error, "erase-player: subject lookup failed");
            report.outcome = "database_unavailable";
            return exit::DATABASE;
        }
    };
    report.player_found = player.is_some();
    if command.dry_run {
        if let Some(player) = player {
            match count_account_data(pool, player).await {
                Ok(rows) => report.rows_found = rows,
                Err(error) => {
                    tracing::error!(%error, "erase-player: count failed");
                    report.outcome = "database_unavailable";
                    return exit::DATABASE;
                }
            }
        }
        report.outcome = "dry_run";
        return exit::OK;
    }
    // Never half an erasure: without Auth the sign-in would stay live.
    let Some(auth) = auth else {
        report.outcome = "auth_unconfigured";
        return exit::CONFIG;
    };
    // The in-app rule: a subscription that still renews is cancelled first.
    if let (Some(money), Some(player)) = (money, player) {
        match money.has_renewing_subscription(&player.to_string()).await {
            Ok(false) => {}
            Ok(true) => {
                report.outcome = "cancel_subscription_first";
                return exit::MONEY;
            }
            Err(error) => {
                tracing::error!(%error, "erase-player: Money subscription check failed");
                report.outcome = "money_unavailable";
                return exit::MONEY;
            }
        }
    }
    let Some(player) = player else {
        // No rows name this subject (already erased, or a new-form subject
        // that never reached Puzzled): only the sign-in can be left.
        return match auth.delete_principal(&command.subject).await {
            Ok(request) => {
                if request.is_some() {
                    report.subjects_filed = 1;
                } else {
                    report.subjects_absent = 1;
                }
                report.outcome = "sign_in_only";
                exit::OK
            }
            Err(AuthError::Refused(error)) => {
                tracing::error!(%error, "erase-player: Auth refused the deletion");
                report.outcome = "auth_refused";
                exit::AUTH
            }
            Err(AuthError::Ambiguous(error)) => {
                tracing::error!(%error, "erase-player: Auth did not confirm the deletion");
                report.outcome = "sign_in_unconfirmed";
                exit::AUTH
            }
        };
    };
    match erase_player(pool, player, Some(auth), Some(&command.subject)).await {
        Ok(erased) => {
            report.rows_deleted = erased.rows_deleted;
            report.subjects_filed = erased.filed.len();
            report.subjects_absent = erased.absent.len();
            report.attempts = erased.attempts;
            report.outcome = "erased";
            exit::OK
        }
        // `EraseError`'s Display carries no subject; its `subjects()` is not
        // read here.
        Err(EraseError::SignInRefused(error)) => {
            tracing::error!(%error, "erase-player: Auth refused; nothing erased");
            report.outcome = "auth_refused";
            exit::AUTH
        }
        Err(error @ EraseError::SignInMaybeDeleted { .. }) => {
            tracing::error!(%error, "erase-player: Auth did not confirm; no row erased");
            report.outcome = "sign_in_unconfirmed";
            exit::AUTH
        }
        Err(error @ EraseError::Database { .. }) => {
            tracing::error!(%error, "erase-player: database failed; no row erased");
            report.outcome = "database_unavailable";
            exit::DATABASE
        }
    }
}

/// Entry point for `puzzled-server erase-player …`.
pub async fn main(args: &[String]) -> i32 {
    let command = match parse(args) {
        Ok(command) => command,
        Err(message) => {
            eprintln!("{message}");
            return exit::USAGE;
        }
    };
    let Some(url) = crate::shared::db_config::select_database_url() else {
        eprintln!("no database URL is bound (DATABASE_URL / POSTGRES_URL)");
        return exit::CONFIG;
    };
    let pool = match crate::shared::db_config::writer_pool_options(
        sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(15)),
    )
    .connect(&url)
    .await
    {
        Ok(pool) => pool,
        Err(error) => {
            tracing::error!(%error, "postgres connect failed");
            return exit::DATABASE;
        }
    };
    let money = Money::from_env();
    let auth = AuthErasure::from_env();
    let code = run(
        &command,
        &pool,
        money.as_ref(),
        auth.as_ref(),
        &mut std::io::stdout(),
    )
    .await;
    pool.close().await;
    code
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn a_subject_is_required_and_dry_run_is_optional() {
        assert_eq!(
            parse(&args(&["--subject", "usr_a"])),
            Ok(Command {
                subject: "usr_a".into(),
                dry_run: false
            })
        );
        assert_eq!(
            parse(&args(&["--dry-run", "--subject", "usr_a"])),
            Ok(Command {
                subject: "usr_a".into(),
                dry_run: true
            })
        );
        assert!(parse(&args(&[])).is_err());
        assert!(parse(&args(&["--subject"])).is_err());
        assert!(parse(&args(&["--subject", " "])).is_err());
        assert!(parse(&args(&["--subject", "usr_a", "--apply"])).is_err());
    }
}
