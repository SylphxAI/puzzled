//! Step 3: the `billing_*` rows, written out before the tables are dropped.
//!
//! One newline-delimited JSON object per table plus a manifest with row counts
//! and SHA-256 sums, written under `billing/<date>/` to Puzzled's own Sylphx
//! Store bucket `billing-archive`, which the job creates itself (idempotently:
//! not versioned, six-year retention that refuses DELETE only), then read back
//! from the bucket and compared to the database. That retention is not WORM:
//! overwrites are allowed, so objects are written once and never replaced here,
//! and the real lock (COMPLIANCE object lock with a six-year `retain_until`,
//! Store, from 10-03) is applied to these objects before the tables are dropped.

use std::sync::Arc;
use std::time::Duration;

use base64::Engine;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::PgPool;

/// The tables the deletion drops.
pub const TABLES: [&str; 3] = [
    "billing_customers",
    "billing_subscriptions",
    "billing_ledger",
];

/// The bucket id, and the key that makes creating it idempotent.
pub const BUCKET_ID: &str = "billing-archive";
const BUCKET_IDEMPOTENCY_KEY: &str = "puzzled-billing-archive-v1";

/// One table's export.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Exported {
    pub table: &'static str,
    pub rows: u64,
    pub sha256: String,
}

/// Puzzled's own archive bucket, through the Store API with the product's own
/// `SYLPHX_API_KEY` (its `*:write` covers `data:write` on its own project and
/// env).
#[derive(Clone)]
pub struct Archive {
    http: reqwest::Client,
    /// `https://api.sylphx.com`.
    origin: String,
    /// `{origin}/v1/orgs/{o}/projects/{p}/envs/{e}`, read from the key's
    /// `whoami` on first use (never configured).
    env_url: std::sync::Arc<tokio::sync::OnceCell<String>>,
    key: String,
}

/// `billing/<UTC date>/`: where one export lives.
#[must_use]
pub fn prefix_for(date: chrono::NaiveDate) -> String {
    format!("billing/{date}/")
}

impl Archive {
    /// `SYLPHX_API_KEY` (and `SYLPHX_API_URL`, default `https://api.sylphx.com`).
    /// The org, project and env the bucket is created in are the key's own,
    /// from its `whoami`.
    pub fn from_env() -> Result<Self, String> {
        let var = |name: &str| {
            std::env::var(name)
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
        };
        Ok(Self::discovering(
            &var("SYLPHX_API_URL").unwrap_or_else(|| DEFAULT_API_URL.to_string()),
            &var("SYLPHX_API_KEY").ok_or("SYLPHX_API_KEY is not set")?,
        ))
    }

    /// An archive whose environment is read from the key on first use.
    #[must_use]
    pub fn discovering(origin: &str, key: &str) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            origin: origin.trim_end_matches('/').to_string(),
            env_url: Arc::default(),
            key: key.to_string(),
        }
    }

    /// An archive with a known environment URL (tests).
    #[must_use]
    pub fn new(env_url: &str, key: &str) -> Self {
        let env_url = env_url.trim_end_matches('/').to_string();
        let origin = env_url.split("/v1/").next().unwrap_or(&env_url).to_string();
        let archive = Self::discovering(&origin, key);
        let _ = archive.env_url.set(env_url);
        archive
    }

    async fn env(&self) -> Result<&str, String> {
        self.env_url
            .get_or_try_init(|| async {
                crate::capabilities::money::client::resolve_env_url(
                    &self.http,
                    &self.origin,
                    &self.key,
                )
                .await
                .map_err(|e| e.to_string())
            })
            .await
            .map(String::as_str)
    }

    /// Create `billing-archive` if it does not exist: not versioned, six-year
    /// retention (`189216000s`, refuses DELETE only). "Already exists" is
    /// success; the fixed `Idempotency-Key` makes a rerun the same request.
    pub async fn ensure_bucket(&self) -> Result<(), String> {
        let response = self
            .http
            .post(format!(
                "{}/buckets?bucket_id={BUCKET_ID}",
                self.env().await?
            ))
            .bearer_auth(&self.key)
            .header("Idempotency-Key", BUCKET_IDEMPOTENCY_KEY)
            .json(&json!({"spec": {"versioning_enabled": false, "retention": "189216000s"}}))
            .send()
            .await
            .map_err(|e| format!("archive bucket create failed: {e}"))?;
        let status = response.status();
        if status.is_success() || status == reqwest::StatusCode::CONFLICT {
            Ok(())
        } else {
            Err(format!("archive bucket create answered {status}"))
        }
    }

    fn url(&self, name: &str) -> String {
        format!("{}/v1/objects/{BUCKET_ID}/{name}", self.origin)
    }

    /// The object's bytes, or None when it does not exist.
    pub async fn get(&self, name: &str) -> Result<Option<Vec<u8>>, String> {
        let response = self
            .http
            .get(self.url(name))
            .bearer_auth(&self.key)
            .send()
            .await
            .map_err(|e| format!("archive read failed: {e}"))?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(format!("archive read answered {}", response.status()));
        }
        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("archive answer unreadable: {e}"))?;
        let encoded = body.get("body").and_then(Value::as_str).unwrap_or_default();
        base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map(Some)
            .map_err(|e| format!("archive body unreadable: {e}"))
    }

    /// Write once: an object that already holds these exact bytes is left
    /// alone (a rerun is safe); one that holds different bytes is an error,
    /// because the bucket is retention-locked and must never be overwritten.
    pub async fn put_once(&self, name: &str, bytes: &[u8]) -> Result<(), String> {
        if let Some(existing) = self.get(name).await? {
            return if existing == bytes {
                Ok(())
            } else {
                Err(format!("{name} already exists with different content"))
            };
        }
        let response = self
            .http
            .put(self.url(name))
            .bearer_auth(&self.key)
            .json(&json!({
                "body": base64::engine::general_purpose::STANDARD.encode(bytes),
                "content_type": "application/x-ndjson",
                "expected_version": "0",
            }))
            .send()
            .await
            .map_err(|e| format!("archive write failed: {e}"))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("archive write answered {}", response.status()))
        }
    }
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

fn ndjson(lines: &[String]) -> Vec<u8> {
    let mut text = lines.join("\n");
    if !lines.is_empty() {
        text.push('\n');
    }
    text.into_bytes()
}

/// Write every table and the manifest under `prefix`, then read them back from
/// the bucket and compare them to the database. Returns the manifest rows.
pub async fn run_export(
    pool: &PgPool,
    archive: &Archive,
    prefix: &str,
) -> Result<Vec<Exported>, String> {
    archive.ensure_bucket().await?;
    let mut manifest = Vec::new();
    for table in TABLES {
        let lines = table_json(pool, table).await?;
        archive
            .put_once(&format!("{prefix}{table}.ndjson"), &ndjson(&lines))
            .await?;
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
    archive
        .put_once(
            &format!("{prefix}manifest.tsv"),
            format!("{text}\n").as_bytes(),
        )
        .await?;
    verify_export(pool, archive, prefix).await?;
    tracing::info!(
        tables = manifest.len(),
        "billing export written and read back"
    );
    Ok(manifest)
}

/// Read the objects back from the bucket: each table's lines must be the
/// table's rows as they are now, with the manifest's count and checksum.
pub async fn verify_export(pool: &PgPool, archive: &Archive, prefix: &str) -> Result<(), String> {
    let manifest = archive
        .get(&format!("{prefix}manifest.tsv"))
        .await?
        .ok_or("the manifest is not in the bucket")?;
    let manifest = String::from_utf8(manifest).map_err(|_| "manifest is not text".to_string())?;
    for table in TABLES {
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
        let written = archive
            .get(&format!("{prefix}{table}.ndjson"))
            .await?
            .ok_or_else(|| format!("{table} is not in the bucket"))?;
        let written = String::from_utf8(written).map_err(|_| format!("{table} is not text"))?;
        let lines: Vec<String> = written.lines().map(str::to_string).collect();
        if lines.len() as u64 != rows || digest(&lines) != sum {
            return Err(format!("{table} export does not match its manifest"));
        }
        if table_json(pool, table).await? != lines {
            return Err(format!("{table} changed since the export was written"));
        }
    }
    Ok(())
}
