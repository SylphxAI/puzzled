//! Self-serve erasure: delete every row keyed to one player.
//!
//! `USER_KEYED_COLUMNS` is the whole list of (table, column) pairs that hold a
//! player id. A test reads the Atlas migrations and fails when a table gains a
//! player-id column that is not listed here, so a new table cannot be left out
//! of erasure silently.

use std::collections::BTreeSet;
use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::capabilities::identity_access::adapters::auth_erasure::AuthErasure;
use crate::capabilities::identity_access::adapters::{auth_subjects, guest_credentials};

/// Every (table, column) that stores a player id, with the statement that
/// erases it. Rows matching the player are deleted, including audit rows where
/// they are the subject or the actor.
///
/// Money facts are Sylphx Money's, not this database's. The erasure call
/// refuses while a Money subscription still renews, so nothing is charged to an
/// erased account.
pub const USER_KEYED_COLUMNS: &[(&str, &str, &str)] = &[
    (
        "guest_credentials",
        "user_id",
        r#"DELETE FROM "guest_credentials" WHERE "user_id" = $1"#,
    ),
    (
        "guest_credentials",
        "adopted_user_id",
        r#"DELETE FROM "guest_credentials" WHERE "adopted_user_id" = $1"#,
    ),
    (
        "game_sessions",
        "adopted_from_guest",
        r#"DELETE FROM "game_sessions" WHERE "adopted_from_guest" = $1"#,
    ),
    (
        "result_shares",
        "adopted_from_guest",
        r#"DELETE FROM "result_shares" WHERE "adopted_from_guest" = $1"#,
    ),
    (
        "tryit_conversions",
        "user_id",
        r#"DELETE FROM "tryit_conversions" WHERE "user_id" = $1"#,
    ),
    (
        "account_attribution",
        "user_id",
        r#"DELETE FROM "account_attribution" WHERE "user_id" = $1"#,
    ),
    (
        "auth_subjects",
        "user_id",
        r#"DELETE FROM "auth_subjects" WHERE "user_id" = $1"#,
    ),
    (
        "checkout_consents",
        "user_id",
        r#"DELETE FROM "checkout_consents" WHERE "user_id" = $1"#,
    ),
    (
        "family_members",
        "owner_user_id",
        r#"DELETE FROM "family_members" WHERE "owner_user_id" = $1"#,
    ),
    (
        "family_members",
        "member_user_id",
        r#"DELETE FROM "family_members" WHERE "member_user_id" = $1"#,
    ),
    (
        "family_groups",
        "owner_user_id",
        r#"DELETE FROM "family_groups" WHERE "owner_user_id" = $1"#,
    ),
    (
        "announcement_dismissals",
        "user_id",
        r#"DELETE FROM "announcement_dismissals" WHERE "user_id" = $1"#,
    ),
    (
        "audit_logs",
        "user_id",
        r#"DELETE FROM "audit_logs" WHERE "user_id" = $1"#,
    ),
    (
        "audit_logs",
        "actor_id",
        r#"DELETE FROM "audit_logs" WHERE "actor_id" = $1"#,
    ),
    (
        "game_sessions",
        "user_id",
        r#"DELETE FROM "game_sessions" WHERE "user_id" = $1"#,
    ),
    (
        "notification_preferences",
        "user_id",
        r#"DELETE FROM "notification_preferences" WHERE "user_id" = $1"#,
    ),
    (
        "push_subscriptions",
        "user_id",
        r#"DELETE FROM "push_subscriptions" WHERE "user_id" = $1"#,
    ),
    (
        "result_shares",
        "user_id",
        r#"DELETE FROM "result_shares" WHERE "user_id" = $1"#,
    ),
    (
        "user_display_cache",
        "user_id",
        r#"DELETE FROM "user_display_cache" WHERE "user_id" = $1"#,
    ),
    (
        "user_freeze_data",
        "user_id",
        r#"DELETE FROM "user_freeze_data" WHERE "user_id" = $1"#,
    ),
    (
        "streak_freeze_awards",
        "user_id",
        r#"DELETE FROM "streak_freeze_awards" WHERE "user_id" = $1"#,
    ),
    (
        "streak_freeze_uses",
        "user_id",
        r#"DELETE FROM "streak_freeze_uses" WHERE "user_id" = $1"#,
    ),
    (
        "user_preferences",
        "user_id",
        r#"DELETE FROM "user_preferences" WHERE "user_id" = $1"#,
    ),
    (
        "win_back_emails",
        "user_id",
        r#"DELETE FROM "win_back_emails" WHERE "user_id" = $1"#,
    ),
];

/// How many times one erasure runs its transaction before it reports a
/// database failure, and the pause before each retry. Bounded and short: the
/// person is waiting on the request.
const ATTEMPTS: usize = 4;
const BACKOFF: [Duration; ATTEMPTS - 1] = [
    Duration::from_millis(100),
    Duration::from_millis(400),
    Duration::from_millis(1600),
];

/// A finished erasure: rows deleted (by the attempt that committed), and the
/// Auth subjects whose deletion Auth accepted or no longer held.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Erased {
    pub rows_deleted: u64,
    pub subjects_filed: usize,
    pub subjects_absent: usize,
    pub attempts: usize,
}

/// Why an erasure did not finish. Every variant leaves the player's rows
/// whole: the deletes and the subject map run in one transaction that never
/// committed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EraseError {
    /// Auth refused the deletion or could not be reached. The transaction was
    /// rolled back before commit, so the account and its sign-in stay whole
    /// and the request can be repeated.
    SignIn(String),
    /// The database failed every attempt (or a non-transient error). When
    /// `sign_in_deleted` is true Auth had already accepted the deletion, so
    /// the person can no longer sign in to retry: `puzzled-server
    /// erase-player --subject <subject>` finishes it.
    Database {
        error: String,
        sign_in_deleted: bool,
    },
}

impl std::fmt::Display for EraseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SignIn(error) => write!(f, "sign-in deletion failed: {error}"),
            Self::Database {
                error,
                sign_in_deleted,
            } => write!(
                f,
                "account deletion failed (sign-in deleted: {sign_in_deleted}): {error}"
            ),
        }
    }
}

/// A database failure worth repeating the whole transaction for: the
/// connection dropped (the 2026-10-02 `Connection reset by peer`), the pool
/// timed out, the server restarted or failed over, or Postgres asked for a
/// retry (serialization failure, deadlock). Anything else is a real refusal.
#[must_use]
pub fn is_transient(error: &sqlx::Error) -> bool {
    match error {
        sqlx::Error::Io(_) | sqlx::Error::PoolTimedOut | sqlx::Error::WorkerCrashed => true,
        sqlx::Error::Database(db) => db.code().is_some_and(|code| {
            matches!(
                code.as_ref(),
                "40001" | "40P01" | "57P01" | "57P02" | "57P03"
            ) || code.starts_with("08")
        }),
        _ => false,
    }
}

/// One attempt's failure, before the retry policy reads it.
enum Failure {
    Database(sqlx::Error, &'static str),
    IdentitySetChanged,
    SignIn(String),
}

impl Failure {
    fn at(table: &'static str) -> impl FnOnce(sqlx::Error) -> Self {
        move |error| Self::Database(error, table)
    }
}

/// Erase an account and its adopted source guests, and (when `sign_in` is
/// given) the person's Sylphx Auth sign-in, as one unit.
///
/// Order, inside ONE transaction: lock the identity set, read the Auth
/// subjects that name the player, delete every player-keyed row (the subject
/// map included), then file Auth's deletion for each subject, then commit.
/// So:
/// - a database failure before Auth is called rolls everything back and the
///   person can still sign in and retry;
/// - an Auth refusal rolls the deletes back, so no live sign-in is left on an
///   empty account;
/// - only a failure of the commit itself, after Auth accepted, can leave
///   rows behind a deleted sign-in. That window is the commit alone, and
///   transient failures there are retried here (Auth is not asked again for
///   a subject it already accepted); the subject map survives every failed
///   attempt, so `erase-player --subject` can always finish it.
///
/// `named_subject` adds a subject the caller knows (an operator's
/// `--subject`) to those the map records. Transient database errors are
/// retried with a short bounded backoff ([`is_transient`]).
pub async fn erase_player(
    pool: &PgPool,
    player: Uuid,
    sign_in: Option<&AuthErasure>,
    named_subject: Option<&str>,
) -> Result<Erased, EraseError> {
    let mut filed = BTreeSet::new();
    let mut absent = BTreeSet::new();
    let mut last = String::from("account deletion identity set changed");
    for attempt in 1..=ATTEMPTS {
        let outcome = erase_once(
            pool,
            player,
            sign_in,
            named_subject,
            &mut filed,
            &mut absent,
        )
        .await;
        let retry = match outcome {
            Ok(rows_deleted) => {
                return Ok(Erased {
                    rows_deleted,
                    subjects_filed: filed.len(),
                    subjects_absent: absent.len(),
                    attempts: attempt,
                })
            }
            Err(Failure::SignIn(error)) => return Err(EraseError::SignIn(error)),
            Err(Failure::IdentitySetChanged) => {
                last = "account deletion identity set changed".into();
                true
            }
            Err(Failure::Database(error, table)) => {
                let retry = is_transient(&error);
                last = format!("account deletion failed on {table}: {error}");
                if retry {
                    tracing::warn!(attempt, error = %last, "account erasure attempt failed; retrying");
                }
                retry
            }
        };
        if !retry {
            break;
        }
        if let Some(pause) = BACKOFF.get(attempt - 1) {
            tokio::time::sleep(*pause).await;
        }
    }
    Err(EraseError::Database {
        error: last,
        sign_in_deleted: !filed.is_empty() || !absent.is_empty(),
    })
}

async fn erase_once(
    pool: &PgPool,
    uid: Uuid,
    sign_in: Option<&AuthErasure>,
    named_subject: Option<&str>,
    filed: &mut BTreeSet<String>,
    absent: &mut BTreeSet<String>,
) -> Result<u64, Failure> {
    let mut tx = pool.begin().await.map_err(Failure::at("begin"))?;
    let linked: Vec<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM guest_credentials WHERE adopted_user_id = $1 ORDER BY user_id",
    )
    .bind(uid)
    .fetch_all(&mut *tx)
    .await
    .map_err(Failure::at("guest_credentials"))?;
    let mut players = vec![uid];
    players.extend(linked.iter().copied());
    guest_credentials::lock_players(&mut tx, players.clone())
        .await
        .map_err(Failure::at("lock"))?;
    let locked_linked: Vec<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM guest_credentials WHERE adopted_user_id = $1 ORDER BY user_id",
    )
    .bind(uid)
    .fetch_all(&mut *tx)
    .await
    .map_err(Failure::at("guest_credentials"))?;
    if linked != locked_linked {
        let _ = tx.rollback().await;
        return Err(Failure::IdentitySetChanged);
    }
    // Read under the lock and before the map rows are deleted below.
    let mut subjects = auth_subjects::recorded_subjects(&mut tx, uid)
        .await
        .map_err(Failure::at("auth_subjects"))?;
    // No row and nothing filed yet: the player predates the map, and the old
    // form is the only handle Auth knows. (Once a subject was filed, an empty
    // map means an earlier attempt's commit landed after all.)
    if subjects.is_empty() && filed.is_empty() && absent.is_empty() {
        subjects.push(format!("principal-{uid}"));
    }
    if let Some(named) = named_subject {
        if !subjects.iter().any(|s| s == named) {
            subjects.push(named.to_string());
        }
    }
    let mut deleted = 0u64;
    // Registry rows are last: never erase the only source-guest linkage
    // before visiting its collision rows, freezes, and adoption trails.
    for credentials in [false, true] {
        for player in &players {
            for (table, _column, statement) in USER_KEYED_COLUMNS {
                if (*table == "guest_credentials") != credentials {
                    continue;
                }
                let result = sqlx::query(*statement)
                    .bind(player)
                    .execute(&mut *tx)
                    .await
                    .map_err(Failure::at(table))?;
                deleted += result.rows_affected();
            }
        }
    }
    if let Some(auth) = sign_in {
        for subject in subjects {
            if filed.contains(&subject) || absent.contains(&subject) {
                continue;
            }
            match auth.delete_principal(&subject).await {
                Ok(Some(request_id)) => {
                    tracing::info!(
                        subject,
                        privacy_request_id = %request_id,
                        "sylphx auth account deletion requested"
                    );
                    filed.insert(subject);
                }
                // Auth holds no such account (already deleted, or never
                // created): the person has nothing left to sign in with.
                Ok(None) => {
                    tracing::info!(subject, "sylphx auth holds no account to delete");
                    absent.insert(subject);
                }
                Err(error) => {
                    tracing::error!(%error, subject, "sylphx auth account deletion failed");
                    let _ = tx.rollback().await;
                    return Err(Failure::SignIn(error));
                }
            }
        }
    }
    tx.commit().await.map_err(Failure::at("commit"))?;
    Ok(deleted)
}

/// Erase an account's rows only (no Auth call). The platform's erasure
/// delivery starts at Auth, so its handler needs only this half.
pub async fn delete_account_data(pool: &PgPool, user_id: &str) -> Result<u64, String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    erase_player(pool, uid, None, None)
        .await
        .map(|erased| erased.rows_deleted)
        .map_err(|error| error.to_string())
}

/// What an erasure of this player would delete, by count, without deleting
/// anything (the operator's dry run). An upper bound: a row that names the
/// player in two columns counts twice.
pub async fn count_account_data(pool: &PgPool, player: Uuid) -> Result<u64, sqlx::Error> {
    let mut connection = pool.acquire().await?;
    let mut players = vec![player];
    players.extend(
        sqlx::query_scalar::<_, Uuid>(
            "SELECT user_id FROM guest_credentials WHERE adopted_user_id = $1",
        )
        .bind(player)
        .fetch_all(&mut *connection)
        .await?,
    );
    let mut total = 0u64;
    for player in &players {
        for (_, _, statement) in USER_KEYED_COLUMNS {
            let count = statement.replacen("DELETE FROM", "SELECT count(*) FROM", 1);
            let rows: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(count))
                .bind(player)
                .fetch_one(&mut *connection)
                .await?;
            total += u64::try_from(rows).unwrap_or_default();
        }
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::USER_KEYED_COLUMNS;
    use std::collections::BTreeSet;
    use std::path::Path;

    /// Player-id columns declared by the migrations, as (table, column).
    fn player_id_columns_in_migrations() -> BTreeSet<(String, String)> {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../apps/puzzled/atlas/migrations");
        let mut sql = String::new();
        let mut files: Vec<_> = std::fs::read_dir(&dir)
            .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().is_some_and(|ext| ext == "sql"))
            .collect();
        files.sort();
        for file in files {
            sql.push_str(&std::fs::read_to_string(&file).unwrap_or_default());
            sql.push('\n');
        }

        let is_player_column = |name: &str| {
            name == "user_id"
                || name.ends_with("_user_id")
                || name == "actor_id"
                || name == "adopted_from_guest"
        };
        let mut found = BTreeSet::new();
        let mut table: Option<String> = None;
        for line in sql.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("CREATE TABLE ") {
                table = rest
                    .trim_start_matches("IF NOT EXISTS ")
                    .split('"')
                    .find(|part| !part.is_empty() && *part != "public" && *part != ".")
                    .map(str::to_string);
                continue;
            }
            if trimmed.starts_with(");") {
                table = None;
                continue;
            }
            if let Some(table) = &table {
                if let Some(column) = trimmed
                    .strip_prefix('"')
                    .and_then(|rest| rest.split('"').next())
                {
                    if is_player_column(column) {
                        found.insert((table.clone(), column.to_string()));
                    }
                }
            }
            // A table renamed to `..._retired_...` is empty (its migration
            // refuses to run over rows), so it holds no player data to erase.
            if let Some(rest) = trimmed.strip_prefix("ALTER TABLE ") {
                let parts: Vec<&str> = rest.split('"').collect();
                if let (Some(old), true) = (
                    parts.get(1),
                    parts.iter().any(|p| p.contains("RENAME TO"))
                        && parts.get(3).is_some_and(|new| new.contains("__retired_")),
                ) {
                    found.retain(|(t, _)| t != old);
                }
            }
            // ALTER TABLE "t" ADD COLUMN "user_id" ...
            if let Some(rest) = trimmed.strip_prefix("ALTER TABLE ") {
                let parts: Vec<&str> = rest.split('"').collect();
                if let (Some(t), Some(pos)) = (
                    parts.get(1),
                    parts.iter().position(|p| p.contains("ADD COLUMN")),
                ) {
                    if let Some(column) = parts.get(pos + 1) {
                        if is_player_column(column) {
                            found.insert(((*t).to_string(), (*column).to_string()));
                        }
                    }
                }
            }
        }
        found
    }

    #[test]
    fn a_dropped_connection_is_transient_and_a_refusal_is_not() {
        use super::is_transient;
        let reset = std::io::Error::new(std::io::ErrorKind::ConnectionReset, "reset by peer");
        assert!(is_transient(&sqlx::Error::Io(reset)));
        assert!(is_transient(&sqlx::Error::PoolTimedOut));
        assert!(!is_transient(&sqlx::Error::RowNotFound));
        assert!(!is_transient(&sqlx::Error::Protocol("bad".into())));
    }

    #[test]
    fn each_statement_erases_its_own_column() {
        for (table, column, statement) in USER_KEYED_COLUMNS {
            let delete = format!(r#"DELETE FROM "{table}" WHERE "{column}" = $1"#);
            assert_eq!(*statement, delete);
        }
    }

    /// Puzzled's former billing tables. Sylphx Money holds subscriptions and
    /// the ledger now; these tables are kept, unread and unwritten, until the
    /// contract migration after Money live proof retires them (its guard
    /// refuses to run over any row). No code touches them, so erasure has
    /// nothing to erase there: `retiring_billing_tables_have_no_runtime_reader`
    /// holds that.
    const RETIRING_TABLES: [&str; 3] = [
        "billing_customers",
        "billing_subscriptions",
        "billing_ledger",
    ];

    #[test]
    fn erasure_covers_every_player_id_column() {
        let declared: BTreeSet<(String, String)> = player_id_columns_in_migrations()
            .into_iter()
            .filter(|(table, _)| !RETIRING_TABLES.contains(&table.as_str()))
            .collect();
        assert!(
            !declared.is_empty(),
            "no player-id columns parsed from migrations"
        );
        let covered: BTreeSet<(String, String)> = USER_KEYED_COLUMNS
            .iter()
            .map(|(t, c, _)| ((*t).to_string(), (*c).to_string()))
            .collect();
        let missing: Vec<_> = declared.difference(&covered).collect();
        assert!(
            missing.is_empty(),
            "player-id columns missing from USER_KEYED_COLUMNS: {missing:?}"
        );
        let stale: Vec<_> = covered.difference(&declared).collect();
        assert!(
            stale.is_empty(),
            "USER_KEYED_COLUMNS names columns no migration declares: {stale:?}"
        );
    }

    /// No runtime code path (server, core, or web app) names a retiring
    /// billing table: they stay only for schema/migration parity until the
    /// contract migration. Tests and the Drizzle schema are the exceptions.
    #[test]
    fn retiring_billing_tables_have_no_runtime_reader() {
        fn walk(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
            for entry in std::fs::read_dir(dir)
                .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
                .flatten()
            {
                let path = entry.path();
                if path.is_dir() {
                    walk(&path, out);
                } else {
                    out.push(path);
                }
            }
        }
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
        let mut files = Vec::new();
        for dir in [
            "crates/puzzled-core/src",
            "crates/puzzled-server/src",
            "apps/puzzled/src",
        ] {
            walk(&root.join(dir), &mut files);
        }
        let schema = root.join("apps/puzzled/src/lib/db/schema.ts");
        let needles = RETIRING_TABLES
            .iter()
            .map(|t| (*t).to_string())
            .chain(
                ["billingCustomers", "billingSubscriptions", "billingLedger"]
                    .iter()
                    .map(|n| (*n).to_string()),
            )
            .collect::<Vec<_>>();
        // The scan sees the schema, so an empty result is not a blind scan.
        let schema_text = std::fs::read_to_string(&schema).unwrap_or_default();
        assert!(
            needles.iter().all(|n| schema_text.contains(n.as_str())),
            "the Drizzle schema no longer defines the retiring tables; update this test"
        );
        let mut readers = Vec::new();
        for file in &files {
            let name = file
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();
            let runtime = match file.extension().and_then(|e| e.to_str()) {
                Some("rs") => !name.ends_with("tests.rs"),
                Some("ts" | "tsx") => {
                    !name.contains(".test.") && !file.ends_with("lib/db/schema.ts")
                }
                _ => false,
            };
            // Identity classification only asks whether a historic account
            // exists; it does not consume billing entitlements or payments.
            if !runtime || file.ends_with("identity_access/adapters/guest_credentials.rs") {
                continue;
            }
            let text = std::fs::read_to_string(file).unwrap_or_default();
            let code = text.split("#[cfg(test)]").next().unwrap_or_default();
            for needle in &needles {
                if code.contains(needle.as_str()) {
                    readers.push(format!("{}: {needle}", file.display()));
                }
            }
        }
        assert!(
            readers.is_empty(),
            "runtime code names a retiring billing table: {readers:?}"
        );
    }
}
