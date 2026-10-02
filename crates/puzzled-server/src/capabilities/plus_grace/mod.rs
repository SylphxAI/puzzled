//! Plus grace grants: an operator command that records, in Sylphx Money, a
//! time-limited Puzzled Plus grant for every account that already played
//! before Plus went on sale. The grant is a ledger record naming the account,
//! the feature, the expiry and the approver; Puzzled's play gate is unchanged
//! and simply reads Money's answer (owner `standards/commercial.md`: "Free or
//! discounted service is a ledger record, never a code path").
//!
//! Run as `puzzled-server plus-grace --dry-run` or `--apply` inside the api's
//! own environment (the `[[jobs]] plus-grace` row in `sylphx.toml`), so it
//! uses the api's database credentials and its Money key and nothing else.
//!
//! - **Real play history:** at least `--min-days` distinct product days with a
//!   finished session (`won` or `lost`, `completed_at` set) before the cutoff.
//!   Guest sessions adopted into an account count for that account, because
//!   adoption moves them (`game_sessions.user_id`, `adopted_from_guest`).
//! - **Account:** a player the api already treats as account-backed
//!   ([`guest_credentials::ACCOUNT_BACKED_SQL`]); every other player with
//!   history is a guest. Money's subject is an account, so guests are counted,
//!   never granted.
//! - **Synthetic or QA:** a cached email matching [`SYNTHETIC_EMAIL_PATTERNS`],
//!   or an Auth subject or player id the operator names with
//!   `--exclude-subject` / `--exclude-player`. Puzzled stores no email or QA
//!   flag of its own, so the Auth-side tag reaches it only that way.
//! - **Output:** one JSON line of aggregate counts. No player id, subject or
//!   email is ever printed or logged.

use std::collections::BTreeMap;
use std::io::Write;

use chrono::{DateTime, Duration, NaiveDateTime, SecondsFormat, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::capabilities::identity_access::adapters::guest_credentials;
use crate::capabilities::money::access::FEATURE_PLUS;
use crate::capabilities::money::grants::{GrantOutcome, OperatorGrant};
use crate::capabilities::money::{Money, MoneyError};

#[cfg(test)]
mod tests;

/// Lower-cased email shapes of synthetic and QA accounts (the CEO standing
/// readback grant tags them `+synthetic-<date>`; QA mail uses `qa-inbox+`).
pub const SYNTHETIC_EMAIL_PATTERNS: &[&str] = &["qa-inbox+%", "%+synthetic%"];

/// Exit codes the job reports.
pub mod exit {
    pub const OK: i32 = 0;
    pub const USAGE: i32 = 2;
    /// Money refused or could not answer; the run stopped (fail closed).
    pub const MONEY: i32 = 3;
    pub const DATABASE: i32 = 4;
    /// A required binding (database URL, Money key) is missing.
    pub const CONFIG: i32 = 5;
}

/// Players who finished something before the cutoff, with the number of
/// distinct days they finished on.
const HISTORY_SQL: &str = r"
SELECT user_id,
       COUNT(DISTINCT COALESCE(day_key, to_char(completed_at, 'YYYY-MM-DD')))::bigint AS days
FROM game_sessions
WHERE status IN ('won', 'lost')
  AND completed_at IS NOT NULL
  AND completed_at < $1
GROUP BY user_id
ORDER BY user_id";

/// (holds a live guest credential, is marked synthetic or excluded).
const CLASSIFY_SQL: &str = r"
SELECT
  EXISTS (SELECT 1 FROM guest_credentials WHERE user_id = $1 AND revoked_at IS NULL),
  EXISTS (SELECT 1 FROM user_display_cache WHERE user_id = $1 AND lower(email) LIKE ANY($2))
    OR EXISTS (SELECT 1 FROM auth_subjects WHERE user_id = $1 AND subject = ANY($3))
    OR $1 = ANY($4)";

/// One grant campaign, fully described by its arguments.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Campaign {
    /// The instant Plus sales opened; only play before it counts.
    pub cutoff: DateTime<Utc>,
    /// When every grant of the campaign ends (cutoff + days).
    pub expires: DateTime<Utc>,
    pub min_days: i64,
    pub approver: String,
    pub reason: String,
    pub exclude_subjects: Vec<String>,
    pub exclude_players: Vec<Uuid>,
}

impl Campaign {
    /// `plus-grace-YYYYMMDD` (the cutoff's UTC date): the same cutoff is the
    /// same campaign, so a re-run names the same grants.
    #[must_use]
    pub fn id(&self) -> String {
        format!("plus-grace-{}", self.cutoff.format("%Y%m%d"))
    }

    #[must_use]
    pub fn grant(&self, account: Uuid) -> OperatorGrant {
        OperatorGrant {
            id: format!("{}-{}", self.id(), account.simple()),
            end_user: account.to_string(),
            feature: FEATURE_PLUS.to_string(),
            expire_time: self.expires,
            source: format!("operator_grants/{}", self.id()),
            reason: self.reason.clone(),
            approver: self.approver.clone(),
        }
    }
}

/// Aggregate eligibility. Never holds an id.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Counts {
    pub players_with_history: u64,
    pub excluded_synthetic: u64,
    pub below_min_days: u64,
    pub eligible_accounts: u64,
    /// Eligible accounts by distinct finish days: `1`, `2-6`, `7+`.
    pub eligible_accounts_by_days: BTreeMap<&'static str, u64>,
    /// Guests holding a live server-issued credential: they keep their history
    /// by signing in, and are then granted as accounts on a re-run.
    pub eligible_guests_credentialed: u64,
    /// Guests with no credential (client-bound legacy ids, including readback
    /// guests); not grantable until Auth serves guests as accounts.
    pub eligible_guests_legacy: u64,
}

fn bucket(days: i64) -> &'static str {
    match days {
        ..=1 => "1",
        2..=6 => "2-6",
        _ => "7+",
    }
}

/// Eligible accounts (sorted, for the apply step only) and the counts.
pub struct Eligibility {
    pub accounts: Vec<Uuid>,
    pub counts: Counts,
}

/// Read eligibility in one read-only snapshot.
pub async fn eligibility(pool: &PgPool, campaign: &Campaign) -> Result<Eligibility, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        .execute(&mut *tx)
        .await?;
    let cutoff: NaiveDateTime = campaign.cutoff.naive_utc();
    let history: Vec<(Uuid, i64)> = sqlx::query_as(HISTORY_SQL)
        .bind(cutoff)
        .fetch_all(&mut *tx)
        .await?;
    let patterns: Vec<String> = SYNTHETIC_EMAIL_PATTERNS
        .iter()
        .map(|p| (*p).to_string())
        .collect();
    let mut counts = Counts::default();
    let mut accounts = Vec::new();
    for (player, days) in history {
        counts.players_with_history += 1;
        let (credentialed, synthetic): (bool, bool) = sqlx::query_as(CLASSIFY_SQL)
            .bind(player)
            .bind(&patterns)
            .bind(&campaign.exclude_subjects)
            .bind(&campaign.exclude_players)
            .fetch_one(&mut *tx)
            .await?;
        if synthetic {
            counts.excluded_synthetic += 1;
            continue;
        }
        if days < campaign.min_days {
            counts.below_min_days += 1;
            continue;
        }
        if guest_credentials::account_backed(&mut tx, player).await? {
            counts.eligible_accounts += 1;
            *counts
                .eligible_accounts_by_days
                .entry(bucket(days))
                .or_default() += 1;
            accounts.push(player);
        } else if credentialed {
            counts.eligible_guests_credentialed += 1;
        } else {
            counts.eligible_guests_legacy += 1;
        }
    }
    tx.commit().await?;
    Ok(Eligibility { accounts, counts })
}

/// What an apply did. Never holds an id.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ApplyReport {
    pub granted: u64,
    pub already_granted: u64,
    /// Accounts not reached because the run stopped.
    pub not_attempted: u64,
    /// Money's refusal or outage that stopped the run, without any id.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stopped_on: Option<String>,
}

fn describe(error: &MoneyError) -> String {
    match error {
        MoneyError::Refused {
            status: 404 | 405 | 501,
            ..
        } => {
            format!("money_grant_create_not_served ({error})")
        }
        _ => error.to_string(),
    }
}

/// Record a grant for each account, in order, stopping at the first Money
/// error (fail closed). A re-run is a no-op for every grant already held.
pub async fn apply_grants(money: &Money, campaign: &Campaign, accounts: &[Uuid]) -> ApplyReport {
    let mut report = ApplyReport::default();
    for (done, account) in accounts.iter().enumerate() {
        match money.ensure_operator_grant(&campaign.grant(*account)).await {
            Ok(GrantOutcome::Created) => report.granted += 1,
            Ok(GrantOutcome::AlreadyHeld) => report.already_granted += 1,
            Err(error) => {
                report.not_attempted = (accounts.len() - done) as u64;
                report.stopped_on = Some(describe(&error));
                tracing::error!(
                    event = "plus_grace_stopped",
                    granted = report.granted,
                    already_granted = report.already_granted,
                    not_attempted = report.not_attempted,
                    error = %describe(&error),
                    "Money refused a grace grant; run stopped"
                );
                return report;
            }
        }
    }
    report
}

/// What to do.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Mode {
    DryRun,
    Apply,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Command {
    pub mode: Mode,
    pub campaign: Campaign,
}

const USAGE_TEXT: &str = "usage: puzzled-server plus-grace (--dry-run | --apply) \
[--cutoff <RFC 3339>] [--days <n>] [--min-days <n>] [--approver <text>] [--reason <text>] \
[--exclude-subject <auth subject>]... [--exclude-player <uuid>]...
  --dry-run   print aggregate counts only (cutoff defaults to now)
  --apply     record one Money grant per eligible account; needs --cutoff and --approver";

/// Parse the arguments after `plus-grace`.
pub fn parse(args: &[String], now: DateTime<Utc>) -> Result<Command, String> {
    let mut mode = None;
    let mut cutoff = None;
    let mut days: i64 = 30;
    let mut min_days: i64 = 1;
    let mut approver = String::new();
    let mut reason =
        String::from("Puzzled Plus launch grace for players who played before sales opened");
    let mut exclude_subjects = Vec::new();
    let mut exclude_players = Vec::new();
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        let mut value = |name: &str| {
            it.next()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
                .ok_or(format!("{name} needs a value"))
        };
        match arg.as_str() {
            "--dry-run" | "--apply" if mode.is_some() => {
                return Err("give exactly one of --dry-run and --apply".into())
            }
            "--dry-run" => mode = Some(Mode::DryRun),
            "--apply" => mode = Some(Mode::Apply),
            "--cutoff" => {
                let raw = value("--cutoff")?;
                cutoff = Some(
                    DateTime::parse_from_rfc3339(&raw)
                        .map_err(|_| "--cutoff must be RFC 3339, e.g. 2026-10-05T00:00:00Z")?
                        .with_timezone(&Utc),
                );
            }
            "--days" => {
                days = value("--days")?
                    .parse()
                    .ok()
                    .filter(|d| (1..=366).contains(d))
                    .ok_or("--days must be 1 to 366")?;
            }
            "--min-days" => {
                min_days = value("--min-days")?
                    .parse()
                    .ok()
                    .filter(|d| (1..=366).contains(d))
                    .ok_or("--min-days must be 1 to 366")?;
            }
            "--approver" => approver = value("--approver")?,
            "--reason" => reason = value("--reason")?,
            "--exclude-subject" => exclude_subjects.push(value("--exclude-subject")?),
            "--exclude-player" => exclude_players.push(
                Uuid::parse_str(&value("--exclude-player")?)
                    .map_err(|_| "--exclude-player must be a uuid")?,
            ),
            "-h" | "--help" => return Err(USAGE_TEXT.into()),
            other => return Err(format!("unknown argument {other:?}\n{USAGE_TEXT}")),
        }
    }
    let mode = mode.ok_or(USAGE_TEXT)?;
    if mode == Mode::Apply {
        if cutoff.is_none() {
            return Err("--apply needs --cutoff (the instant Plus sales opened), so a re-run names the same grants".into());
        }
        if approver.is_empty() {
            return Err(
                "--apply needs --approver (who approved the grant, e.g. \"CEO 2026-10-02\")".into(),
            );
        }
    }
    let cutoff = cutoff.unwrap_or(now);
    Ok(Command {
        mode,
        campaign: Campaign {
            cutoff,
            expires: cutoff + Duration::days(days),
            min_days,
            approver,
            reason,
            exclude_subjects,
            exclude_players,
        },
    })
}

#[derive(Serialize)]
struct Line<'a> {
    event: &'static str,
    mode: &'static str,
    campaign: String,
    cutoff: String,
    expires: String,
    min_days: i64,
    exclusions_given: usize,
    #[serde(flatten)]
    counts: &'a Counts,
    #[serde(skip_serializing_if = "Option::is_none")]
    apply: Option<&'a ApplyReport>,
}

/// The one output line: aggregate counts only.
#[must_use]
pub fn report_line(command: &Command, counts: &Counts, apply: Option<&ApplyReport>) -> String {
    let c = &command.campaign;
    serde_json::to_string(&Line {
        event: "plus_grace",
        mode: match command.mode {
            Mode::DryRun => "dry_run",
            Mode::Apply => "apply",
        },
        campaign: c.id(),
        cutoff: c.cutoff.to_rfc3339_opts(SecondsFormat::Secs, true),
        expires: c.expires.to_rfc3339_opts(SecondsFormat::Secs, true),
        min_days: c.min_days,
        exclusions_given: c.exclude_subjects.len() + c.exclude_players.len(),
        counts,
        apply,
    })
    .unwrap_or_default()
}

/// Run a parsed command; writes the report line to `out` and returns the
/// exit code.
pub async fn run(
    command: &Command,
    pool: &PgPool,
    money: Option<&Money>,
    out: &mut impl Write,
) -> i32 {
    if command.mode == Mode::Apply && money.is_none() {
        let _ = writeln!(
            out,
            "{{\"event\":\"plus_grace\",\"error\":\"SYLPHX_MONEY_API_KEY is not bound\"}}"
        );
        return exit::CONFIG;
    }
    let found = match eligibility(pool, &command.campaign).await {
        Ok(found) => found,
        Err(error) => {
            tracing::error!(%error, "plus grace eligibility read failed");
            let _ = writeln!(
                out,
                "{{\"event\":\"plus_grace\",\"error\":\"database_read_failed\"}}"
            );
            return exit::DATABASE;
        }
    };
    let (report, code) = match (command.mode.clone(), money) {
        (Mode::Apply, Some(money)) => {
            let report = apply_grants(money, &command.campaign, &found.accounts).await;
            let code = if report.stopped_on.is_some() {
                exit::MONEY
            } else {
                exit::OK
            };
            (Some(report), code)
        }
        _ => (None, exit::OK),
    };
    let _ = writeln!(
        out,
        "{}",
        report_line(command, &found.counts, report.as_ref())
    );
    code
}

/// Entry point for `puzzled-server plus-grace …`.
pub async fn main(args: &[String]) -> i32 {
    let command = match parse(args, Utc::now()) {
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
    let pool = match sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(15))
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
    let code = run(&command, &pool, money.as_ref(), &mut std::io::stdout()).await;
    pool.close().await;
    code
}
