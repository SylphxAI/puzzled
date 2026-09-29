//! Step 3: the `billing_*` rows, written out before the tables are dropped.
//!
//! One newline-delimited JSON file per table plus a manifest with row counts
//! and SHA-256 sums, written to `PUZZLED_BILLING_EXPORT_DIR`, then read back
//! and compared to the database.

use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use sqlx::PgPool;

/// The tables the deletion drops.
pub const TABLES: [&str; 3] = [
    "billing_customers",
    "billing_subscriptions",
    "billing_ledger",
];

/// One table's export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Exported {
    pub table: &'static str,
    pub rows: u64,
    pub sha256: String,
}

/// Where the export goes (a mounted volume or the Data archive's mount).
pub fn export_dir() -> Result<PathBuf, String> {
    std::env::var("PUZZLED_BILLING_EXPORT_DIR")
        .ok()
        .filter(|d| !d.trim().is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| "PUZZLED_BILLING_EXPORT_DIR is not set".to_string())
}

async fn table_json(pool: &PgPool, table: &str) -> Result<Vec<String>, String> {
    // `table` is one of TABLES, never caller input.
    let sql = format!(r#"SELECT to_jsonb(t)::text FROM "{table}" t ORDER BY 1"#);
    sqlx::query_scalar::<_, String>(sqlx::AssertSqlSafe(sql))
        .fetch_all(pool)
        .await
        .map_err(|e| format!("export read of {table} failed: {e}"))
}

fn digest(lines: &[String]) -> String {
    let mut hasher = Sha256::new();
    for line in lines {
        hasher.update(line.as_bytes());
        hasher.update(b"\n");
    }
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Write every table and its manifest, then read the files back and compare
/// them to the database. Returns the manifest rows.
pub async fn run_export(pool: &PgPool, dir: &Path) -> Result<Vec<Exported>, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("export dir: {e}"))?;
    let mut manifest = Vec::new();
    for table in TABLE_NAMES {
        let lines = table_json(pool, table).await?;
        let path = dir.join(format!("{table}.ndjson"));
        std::fs::write(
            &path,
            lines.join("\n") + if lines.is_empty() { "" } else { "\n" },
        )
        .map_err(|e| format!("export write of {table}: {e}"))?;
        manifest.push(Exported {
            table,
            rows: lines.len() as u64,
            sha256: digest(&lines),
        });
    }
    let text = manifest
        .iter()
        .map(|m| format!("{}\t{}\t{}", m.table, m.rows, m.sha256))
        .collect::<Vec<_>>()
        .join("\n");
    std::fs::write(dir.join("manifest.tsv"), text + "\n")
        .map_err(|e| format!("export manifest: {e}"))?;
    verify_export(pool, dir).await?;
    tracing::info!(
        tables = manifest.len(),
        "billing export written and read back"
    );
    Ok(manifest)
}

const TABLE_NAMES: [&str; 3] = TABLES;

/// Read the files back: each file's lines must be the table's rows as they
/// are now, with the manifest's count and checksum.
pub async fn verify_export(pool: &PgPool, dir: &Path) -> Result<(), String> {
    let manifest = std::fs::read_to_string(dir.join("manifest.tsv"))
        .map_err(|e| format!("export manifest unreadable: {e}"))?;
    for table in TABLE_NAMES {
        let entry = manifest
            .lines()
            .find(|l| l.split('\t').next() == Some(table))
            .ok_or_else(|| format!("{table} missing from the manifest"))?;
        let mut parts = entry.split('\t').skip(1);
        let rows: u64 = parts
            .next()
            .and_then(|r| r.parse().ok())
            .unwrap_or(u64::MAX);
        let sum = parts.next().unwrap_or_default();
        let written = std::fs::read_to_string(dir.join(format!("{table}.ndjson")))
            .map_err(|e| format!("{table} export unreadable: {e}"))?;
        let lines: Vec<String> = written.lines().map(str::to_string).collect();
        let now = table_json(pool, table).await?;
        if lines.len() as u64 != rows || digest(&lines) != sum {
            return Err(format!("{table} export does not match its manifest"));
        }
        if now != lines {
            return Err(format!("{table} changed since the export was written"));
        }
    }
    Ok(())
}
