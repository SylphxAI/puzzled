//! Reporting a Tryit-referred sign-up or purchase back to Tryit
//! (`POST /api/attribution/conversions`, Tryit `docs/attribution.md`).
//!
//! `tryit_conversions` is the outbox: one row per (account, event), written
//! when the account is created or first pays, and only when the account's
//! first-touch tags say Tryit sent it. The row is sent once inline with a short
//! timeout; a 503, a 429 or a network failure leaves it for the sweep
//! (the `puzzled-tryit-conversions` Compute schedule) to retry. Tryit is idempotent per (product, ref, event),
//! so a repeat send is safe. Only the `ref` leaves Puzzled, authorised with the
//! environment's own `SYLPHX_API_KEY`.

use std::time::Duration;

use chrono::{DateTime, NaiveDateTime, Utc};
use puzzled_core::attribution::Attribution;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

const PRODUCT: &str = "puzzled";
const DEFAULT_URL: &str = "https://tryit.fun";
const TIMEOUT: Duration = Duration::from_secs(3);
/// Tryit refuses an `occurred_at` older than 30 days; stop a day early.
const WINDOW_DAYS: i32 = 29;
/// Give up after this many failed sends (about a day of sweeps).
const MAX_ATTEMPTS: i32 = 144;
const SWEEP_BATCH: i64 = 50;

/// The two events Puzzled reports.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Event {
    Signup,
    Purchase,
}

impl Event {
    fn as_str(self) -> &'static str {
        match self {
            Self::Signup => "signup",
            Self::Purchase => "purchase",
        }
    }
}

/// What Tryit answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    /// Stored, or already stored.
    Reported,
    /// Try again later (503, 429, 5xx, no answer).
    Retry(String),
    /// Tryit will never accept this row (400, 401, 403, 422).
    Rejected(String),
}

/// A client for the conversions endpoint. Absent without `SYLPHX_API_KEY`.
#[derive(Clone)]
pub struct TryitReporter {
    client: reqwest::Client,
    url: String,
    key: String,
}

impl TryitReporter {
    #[must_use]
    pub fn new(base_url: &str, key: &str) -> Option<Self> {
        let key = key.trim();
        if key.is_empty() {
            return None;
        }
        let client = reqwest::Client::builder().timeout(TIMEOUT).build().ok()?;
        Some(Self {
            client,
            url: format!(
                "{}/api/attribution/conversions",
                base_url.trim().trim_end_matches('/')
            ),
            key: key.to_owned(),
        })
    }

    /// From `SYLPHX_API_KEY` and, for a non-production Tryit, `TRYIT_URL`.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        let key = std::env::var("SYLPHX_API_KEY").ok()?;
        let url = std::env::var("TRYIT_URL").unwrap_or_else(|_| DEFAULT_URL.to_owned());
        Self::new(
            if url.trim().is_empty() {
                DEFAULT_URL
            } else {
                &url
            },
            &key,
        )
    }

    /// One call. Never panics and never returns the key.
    pub async fn send(&self, reference: &str, event: Event, occurred_at: DateTime<Utc>) -> Outcome {
        let body = json!({
            "product": PRODUCT,
            "ref": reference,
            "event": event.as_str(),
            "occurred_at": occurred_at.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        });
        let response = self
            .client
            .post(&self.url)
            .bearer_auth(&self.key)
            .json(&body)
            .send()
            .await;
        match response {
            Ok(response) => match response.status().as_u16() {
                200 | 201 => Outcome::Reported,
                status @ (429 | 500..=599) => Outcome::Retry(format!("http {status}")),
                status => Outcome::Rejected(format!("http {status}")),
            },
            Err(error) => Outcome::Retry(if error.is_timeout() {
                "timeout".to_owned()
            } else {
                "unreachable".to_owned()
            }),
        }
    }
}

fn uid(user_id: &str) -> Result<Uuid, String> {
    Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))
}

/// Queue one conversion for the account when its first-touch tags carry a
/// Tryit `ref`; a repeat or an untagged account writes nothing. Returns true
/// when a row was written.
pub async fn enqueue(
    pool: &PgPool,
    user_id: &str,
    tags: &Attribution,
    event: Event,
) -> Result<bool, String> {
    let Some(reference) = tags.tryit_ref() else {
        return Ok(false);
    };
    let result = sqlx::query(
        r#"INSERT INTO "tryit_conversions" ("user_id", "event", "ref", "occurred_at")
           VALUES ($1, $2, $3, (now() AT TIME ZONE 'utc'))
           ON CONFLICT ("user_id", "event") DO NOTHING"#,
    )
    .bind(uid(user_id)?)
    .bind(event.as_str())
    .bind(reference)
    .execute(pool)
    .await
    .map_err(|e| format!("tryit conversion enqueue failed: {e}"))?;
    Ok(result.rows_affected() == 1)
}

/// Queue a purchase for an account whose stored tags say Tryit sent it.
pub async fn enqueue_purchase(pool: &PgPool, user_id: &str) -> Result<bool, String> {
    let Some(tags) =
        crate::capabilities::preferences::adapters::attribution_db::attribution_for_user(
            pool, user_id,
        )
        .await?
    else {
        return Ok(false);
    };
    enqueue(pool, user_id, &tags, Event::Purchase).await
}

type Pending = (Uuid, String, String, NaiveDateTime, i32);

async fn record_outcome(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    row: &Pending,
    outcome: &Outcome,
) -> Result<(), String> {
    let (user, event, _, _, attempts) = row;
    let (reported, gave_up, error) = match outcome {
        Outcome::Reported => (true, false, None),
        Outcome::Retry(error) => (false, attempts + 1 >= MAX_ATTEMPTS, Some(error.as_str())),
        Outcome::Rejected(error) => (false, true, Some(error.as_str())),
    };
    sqlx::query(
        r#"UPDATE "tryit_conversions" SET
             "attempts" = "attempts" + 1,
             "last_attempt_at" = (now() AT TIME ZONE 'utc'),
             "last_error" = $3,
             "reported_at" = CASE WHEN $4 THEN (now() AT TIME ZONE 'utc') ELSE "reported_at" END,
             "gave_up_at" = CASE WHEN $5 THEN (now() AT TIME ZONE 'utc') ELSE "gave_up_at" END
           WHERE "user_id" = $1 AND "event" = $2 AND "reported_at" IS NULL"#,
    )
    .bind(user)
    .bind(event)
    .bind(error)
    .bind(reported)
    .bind(gave_up)
    .execute(&mut **tx)
    .await
    .map_err(|e| format!("tryit conversion outcome failed: {e}"))?;
    Ok(())
}

/// Admit the player before locking its row. One connection and one transaction
/// cover the bounded external send and its outcome, so erasure cannot commit
/// between admission and delivery. Busy/suppressed players skip independently.
async fn send_row(
    pool: &PgPool,
    reporter: &TryitReporter,
    candidate: &Pending,
) -> Result<Option<Outcome>, String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| "tryit admission unavailable".to_string())?;
    let admitted: bool = sqlx::query_scalar("SELECT puzzled_erasure_try_admit($1)")
        .bind(candidate.0)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| "tryit admission failed".to_string())?;
    if !admitted {
        return Ok(None);
    }
    let row: Option<Pending> = sqlx::query_as(
        r#"SELECT user_id,event,ref,occurred_at,attempts FROM tryit_conversions
        WHERE user_id=$1 AND event=$2 AND reported_at IS NULL AND gave_up_at IS NULL
        FOR UPDATE SKIP LOCKED"#,
    )
    .bind(candidate.0)
    .bind(&candidate.1)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| "tryit row claim failed".to_string())?;
    let Some(row) = row else { return Ok(None) };
    // Expiry is per admitted row, not an unfenced bulk UPDATE that could
    // poison unrelated players when a suppressed row occurs in the page.
    let expired: bool = sqlx::query_scalar(
        "SELECT $1::timestamp < (now() AT TIME ZONE 'utc') - make_interval(days => $2)",
    )
    .bind(row.3)
    .bind(WINDOW_DAYS)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| "tryit expiry read failed".to_string())?;
    if expired {
        sqlx::query("UPDATE tryit_conversions SET gave_up_at=(now() AT TIME ZONE 'utc'),last_error=COALESCE(last_error,'outside window') WHERE user_id=$1 AND event=$2")
            .bind(row.0).bind(&row.1).execute(&mut *tx).await.map_err(|_| "tryit expiry write failed".to_string())?;
        tx.commit()
            .await
            .map_err(|_| "tryit expiry commit failed".to_string())?;
        return Ok(None);
    }
    let event = if row.1 == "purchase" {
        Event::Purchase
    } else {
        Event::Signup
    };
    let outcome = tokio::time::timeout(
        Duration::from_secs(5),
        reporter.send(&row.2, event, row.3.and_utc()),
    )
    .await
    .unwrap_or_else(|_| Outcome::Retry("timeout".into()));
    record_outcome(&mut tx, &row, &outcome).await?;
    tx.commit()
        .await
        .map_err(|_| "tryit outcome commit failed".to_string())?;
    Ok(Some(outcome))
}

/// Send the account's unreported conversions once, inline. A failure is kept
/// on the row for the sweep and never fails the caller.
pub async fn report_now(pool: &PgPool, reporter: Option<&TryitReporter>, user_id: &str) {
    let (Some(reporter), Ok(user)) = (reporter, uid(user_id)) else {
        return;
    };
    let rows: Result<Vec<Pending>, _> = sqlx::query_as(
        r#"SELECT "user_id", "event", "ref", "occurred_at", "attempts"
           FROM "tryit_conversions"
           WHERE "user_id" = $1 AND "reported_at" IS NULL AND "gave_up_at" IS NULL"#,
    )
    .bind(user)
    .fetch_all(pool)
    .await;
    match rows {
        Ok(rows) => {
            for row in &rows {
                if send_row(pool, reporter, row).await.is_err() {
                    tracing::warn!("tryit conversion send/outcome unavailable");
                }
            }
        }
        Err(error) => tracing::warn!(%error, "tryit conversion read failed"),
    }
}

/// One sweep: retry unreported rows not tried in the last five minutes;
/// rows past Tryit's 30-day window are given up. Returns rows reported.
pub async fn sweep(pool: &PgPool, reporter: &TryitReporter) -> Result<u32, String> {
    let rows: Vec<Pending> = sqlx::query_as(
        r#"SELECT "user_id", "event", "ref", "occurred_at", "attempts"
           FROM "tryit_conversions"
           WHERE "reported_at" IS NULL AND "gave_up_at" IS NULL
             AND ("last_attempt_at" IS NULL
                  OR "last_attempt_at" < (now() AT TIME ZONE 'utc') - interval '5 minutes')
           ORDER BY "occurred_at" LIMIT $1"#,
    )
    .bind(SWEEP_BATCH)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("tryit conversion sweep read failed: {e}"))?;
    let mut reported = 0;
    for row in &rows {
        if send_row(pool, reporter, row).await? == Some(Outcome::Reported) {
            reported += 1;
        }
    }
    Ok(reported)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use std::sync::{Arc, Mutex};

    use axum::extract::State;
    use axum::http::{HeaderMap, StatusCode};
    use axum::routing::post;
    use axum::{Json, Router};
    use serde_json::Value;

    use super::*;

    type Seen = Arc<Mutex<Vec<(Option<String>, Value)>>>;

    /// A fake Tryit: answers each call with the next status, records what it got.
    async fn fake_tryit(statuses: Vec<u16>) -> (String, Seen) {
        let seen: Seen = Arc::default();
        let script = Arc::new(Mutex::new(statuses));
        async fn handle(
            State((seen, script)): State<(Seen, Arc<Mutex<Vec<u16>>>)>,
            headers: HeaderMap,
            Json(body): Json<Value>,
        ) -> StatusCode {
            let auth = headers
                .get("authorization")
                .and_then(|v| v.to_str().ok())
                .map(str::to_owned);
            seen.lock().unwrap().push((auth, body));
            let mut script = script.lock().unwrap();
            let next = if script.len() > 1 {
                script.remove(0)
            } else {
                script[0]
            };
            StatusCode::from_u16(next).unwrap()
        }
        let app = Router::new()
            .route("/api/attribution/conversions", post(handle))
            .with_state((seen.clone(), script));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        (format!("http://{addr}"), seen)
    }

    #[tokio::test]
    async fn sends_the_ref_only_with_the_products_own_key() {
        let (url, seen) = fake_tryit(vec![201]).await;
        let reporter = TryitReporter::new(&url, "test-key").unwrap();
        let at = DateTime::parse_from_rfc3339("2026-09-29T10:00:00Z")
            .unwrap()
            .to_utc();
        assert_eq!(
            reporter.send("res-42", Event::Signup, at).await,
            Outcome::Reported
        );
        let seen = seen.lock().unwrap();
        assert_eq!(seen[0].0.as_deref(), Some("Bearer test-key"));
        assert_eq!(
            seen[0].1,
            json!({"product": "puzzled", "ref": "res-42", "event": "signup",
                   "occurred_at": "2026-09-29T10:00:00Z"})
        );
    }

    #[tokio::test]
    async fn a_503_is_retryable_and_a_duplicate_is_reported() {
        let (url, _) = fake_tryit(vec![503, 200]).await;
        let reporter = TryitReporter::new(&url, "k").unwrap();
        let at = Utc::now();
        assert_eq!(
            reporter.send("r", Event::Signup, at).await,
            Outcome::Retry("http 503".into())
        );
        assert_eq!(
            reporter.send("r", Event::Signup, at).await,
            Outcome::Reported
        );
    }

    #[tokio::test]
    async fn a_refusal_or_an_unreachable_tryit_is_classified() {
        let (url, _) = fake_tryit(vec![403, 422, 429]).await;
        let reporter = TryitReporter::new(&url, "k").unwrap();
        let at = Utc::now();
        assert_eq!(
            reporter.send("r", Event::Signup, at).await,
            Outcome::Rejected("http 403".into())
        );
        assert_eq!(
            reporter.send("r", Event::Signup, at).await,
            Outcome::Rejected("http 422".into())
        );
        assert_eq!(
            reporter.send("r", Event::Signup, at).await,
            Outcome::Retry("http 429".into())
        );
        let dead = TryitReporter::new("http://127.0.0.1:1", "k").unwrap();
        assert!(matches!(
            dead.send("r", Event::Signup, at).await,
            Outcome::Retry(_)
        ));
    }

    #[test]
    fn no_key_means_no_reporter() {
        assert!(TryitReporter::new("https://tryit.fun", "  ").is_none());
    }
}
