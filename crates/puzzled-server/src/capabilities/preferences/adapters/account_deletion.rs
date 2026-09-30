//! Self-serve erasure: delete every row keyed to one player.
//!
//! `USER_KEYED_COLUMNS` is the whole list of (table, column) pairs that hold a
//! player id. A test reads the Atlas migrations and fails when a table gains a
//! player-id column that is not listed here, so a new table cannot be left out
//! of erasure silently.

use std::collections::BTreeMap;

use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// Every (table, column) that stores a player id, with the statement that
/// erases it. Rows matching the player are deleted, including audit rows where
/// they are the subject or the actor.
///
/// Money facts are the exception: a subscription row and a ledger row are kept
/// for accounting (UK tax records), with the player id cleared so they no
/// longer identify the player. The erasure call refuses while a subscription
/// still renews, so nothing is charged to an erased account.
pub const USER_KEYED_COLUMNS: &[(&str, &str, &str)] = &[
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
        "billing_customers",
        "user_id",
        r#"DELETE FROM "billing_customers" WHERE "user_id" = $1"#,
    ),
    (
        "billing_ledger",
        "user_id",
        r#"UPDATE "billing_ledger" SET "user_id" = NULL WHERE "user_id" = $1"#,
    ),
    (
        "billing_subscriptions",
        "user_id",
        r#"UPDATE "billing_subscriptions" SET "user_id" = NULL WHERE "user_id" = $1"#,
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

/// Tables whose rows outlive the erasure, and why. The row stays, with the
/// player id cleared (see the statements above); the reason goes into the
/// evidence sent to Sylphx Auth.
pub const KEPT_TABLES: &[(&str, &str)] = &[
    (
        "billing_ledger",
        "kept for UK tax records (six years); the player id is cleared so the row no longer identifies the player",
    ),
    (
        "billing_subscriptions",
        "kept for UK tax records (six years); the player id is cleared so the row no longer identifies the player",
    ),
];

/// What one erasure did: rows affected per table (deleted, or unlinked for a
/// kept table) and the reason each kept table still holds rows.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ErasureReport {
    pub rows: BTreeMap<String, u64>,
    pub kept: BTreeMap<String, String>,
}

impl ErasureReport {
    #[must_use]
    pub fn total(&self) -> u64 {
        self.rows.values().sum()
    }

    /// Add another player's report (a subject can name more than one).
    pub fn merge(&mut self, other: Self) {
        for (table, n) in other.rows {
            *self.rows.entry(table).or_default() += n;
        }
        self.kept.extend(other.kept);
    }
}

/// The one erasure path, inside the caller's transaction: the player's own
/// delete and the platform's fan-out both run this.
pub async fn erase_in_transaction(
    tx: &mut Transaction<'_, Postgres>,
    player: Uuid,
) -> Result<ErasureReport, String> {
    let mut report = ErasureReport::default();
    for (table, column, statement) in USER_KEYED_COLUMNS {
        let result = sqlx::query(*statement)
            .bind(player)
            .execute(&mut **tx)
            .await
            .map_err(|e| format!("account deletion failed on {table}.{column}: {e}"))?;
        *report.rows.entry((*table).to_string()).or_default() += result.rows_affected();
    }
    for (table, reason) in KEPT_TABLES {
        report.kept.insert((*table).to_string(), (*reason).to_string());
    }
    Ok(report)
}

/// Delete every row keyed to `user_id` in one transaction; returns rows deleted.
pub async fn delete_account_data(pool: &PgPool, user_id: &str) -> Result<u64, String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("account deletion begin failed: {e}"))?;
    let report = erase_in_transaction(&mut tx, uid).await?;
    tx.commit()
        .await
        .map_err(|e| format!("account deletion commit failed: {e}"))?;
    Ok(report.total())
}

#[cfg(test)]
mod tests {
    use super::{KEPT_TABLES, USER_KEYED_COLUMNS};
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

        let is_player_column =
            |name: &str| name == "user_id" || name.ends_with("_user_id") || name == "actor_id";
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
    fn each_statement_erases_its_own_column() {
        for (table, column, statement) in USER_KEYED_COLUMNS {
            let delete = format!(r#"DELETE FROM "{table}" WHERE "{column}" = $1"#);
            // Money facts keep the row and drop the player id.
            let unlink = format!(r#"UPDATE "{table}" SET "{column}" = NULL WHERE "{column}" = $1"#);
            let is_money = KEPT_TABLES.iter().any(|(kept, _)| kept == table);
            let expected = if is_money { unlink } else { delete };
            assert_eq!(*statement, expected);
        }
    }

    #[test]
    fn erasure_covers_every_player_id_column() {
        let declared = player_id_columns_in_migrations();
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

    #[test]
    fn every_user_keyed_table_is_erased_or_kept_with_a_reason() {
        for (table, column, statement) in USER_KEYED_COLUMNS {
            let kept = KEPT_TABLES.iter().find(|(kept, _)| kept == table);
            match kept {
                Some((_, reason)) => {
                    assert!(!reason.is_empty(), "{table}: kept without a reason");
                    assert!(statement.starts_with("UPDATE"), "{table}.{column}");
                }
                None => assert!(statement.starts_with("DELETE"), "{table}.{column}"),
            }
        }
        for (kept, _) in KEPT_TABLES {
            assert!(
                USER_KEYED_COLUMNS.iter().any(|(table, _, _)| table == kept),
                "{kept} is listed as kept but is not a user-keyed table"
            );
        }
    }
}
