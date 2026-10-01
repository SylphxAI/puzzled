//! Self-serve erasure: delete every row keyed to one player.
//!
//! `USER_KEYED_COLUMNS` is the whole list of (table, column) pairs that hold a
//! player id. A test reads the Atlas migrations and fails when a table gains a
//! player-id column that is not listed here, so a new table cannot be left out
//! of erasure silently.

use sqlx::PgPool;
use uuid::Uuid;

/// Every (table, column) that stores a player id, with the statement that
/// erases it. Rows matching the player are deleted, including audit rows where
/// they are the subject or the actor.
///
/// Money facts are Sylphx Money's, not this database's. The erasure call
/// refuses while a Money subscription still renews, so nothing is charged to an
/// erased account.
pub const USER_KEYED_COLUMNS: &[(&str, &str, &str)] = &[
    (
        "announcements",
        "created_by",
        r#"UPDATE "announcements" SET "created_by" = NULL WHERE "created_by" = $1"#,
    ),
    (
        "app_settings",
        "updated_by",
        r#"UPDATE "app_settings" SET "updated_by" = NULL WHERE "updated_by" = $1"#,
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
        r#"UPDATE "checkout_consents" SET "user_id" = NULL, "retention_expires_at" = COALESCE("retention_expires_at", (transaction_timestamp() AT TIME ZONE 'UTC') + interval '6 years') WHERE "user_id" = $1"#,
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

/// Delete every row keyed to `user_id` in one transaction; returns rows deleted.
pub async fn delete_account_data(pool: &PgPool, user_id: &str) -> Result<u64, String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("account deletion begin failed: {e}"))?;
    let evidence = erase_in_transaction(&mut tx, uid).await?;
    tx.commit()
        .await
        .map_err(|_| "account deletion commit failed".to_string())?;
    Ok(evidence.values().sum())
}

/// Inventory mutation and caller's completion evidence share one transaction.
pub async fn erase_in_transaction(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    player: Uuid,
) -> Result<std::collections::BTreeMap<String, u64>, String> {
    sqlx::query("SELECT puzzled_erasure_lock($1)")
        .bind(player)
        .execute(&mut **tx)
        .await
        .map_err(|_| "account deletion lock failed".to_string())?;
    let mut evidence = std::collections::BTreeMap::new();
    for (table, column, statement) in USER_KEYED_COLUMNS {
        let result = sqlx::query(*statement)
            .bind(player)
            .execute(&mut **tx)
            .await
            .map_err(|_| "account deletion failed".to_string())?;
        let action = if statement.starts_with("UPDATE") {
            "unlinked"
        } else {
            "deleted"
        };
        *evidence
            .entry(format!("{action}:{table}.{column}"))
            .or_insert(0) += result.rows_affected();
    }
    Ok(evidence)
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
                || name == "created_by"
                || name == "updated_by"
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
    fn each_statement_erases_its_own_column() {
        for (table, column, statement) in USER_KEYED_COLUMNS {
            if *table == "checkout_consents" {
                assert!(statement.contains("COALESCE(\"retention_expires_at\""));
                assert!(statement.contains("AT TIME ZONE 'UTC'"));
                assert!(statement.contains("interval '6 years'"));
                assert!(statement.ends_with("WHERE \"user_id\" = $1"));
                continue;
            }
            let expected = if matches!(
                *table,
                "checkout_consents" | "announcements" | "app_settings"
            ) {
                format!(r#"UPDATE "{table}" SET "{column}" = NULL WHERE "{column}" = $1"#)
            } else {
                format!(r#"DELETE FROM "{table}" WHERE "{column}" = $1"#)
            };
            assert_eq!(*statement, expected);
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

    #[test]
    fn database_fence_covers_every_erasure_inventory_column() {
        let migration = include_str!(
            "../../../../../../apps/puzzled/atlas/migrations/20261002000000_erasure_requests.sql"
        );
        for (table, column, _) in USER_KEYED_COLUMNS {
            let trigger = migration
                .lines()
                .find(|line| {
                    line.starts_with("CREATE TRIGGER erasure_write_fence ")
                        && line.contains(&format!("ON \"{table}\""))
                })
                .unwrap_or_else(|| panic!("unfenced player table: {table}"));
            assert!(
                trigger.contains(&format!("'{column}'")),
                "unfenced player column: {table}.{column}"
            );
        }
        assert!(migration.contains("transaction_isolation"));
        assert!(migration.contains("read committed"));
        assert!(migration.contains("SELECT DISTINCT hashtextextended"));
        assert!(migration.contains("puzzled_erasure_try_admit"));
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
            if !runtime {
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
