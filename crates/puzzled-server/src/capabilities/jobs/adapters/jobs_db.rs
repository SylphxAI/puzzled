//! SQL adapters for retention job targeting.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Minutes after a player's reminder time during which it can still go out, so
/// a missed or late tick does not lose the day's reminder.
pub const REMINDER_GRACE_MINUTES: i32 = 120;

/// Bound work acquired by one tick; unprocessed leases expire for later ticks.
pub const REMINDER_CLAIM_BATCH: i64 = 16;
pub const REMINDER_LEASE_SECONDS: i64 = 300;

#[derive(Debug, Clone)]
pub struct DailyReminderClaim {
    pub user_id: String,
    pub local_day: NaiveDate,
    pub token: Uuid,
    pub lease_until: DateTime<Utc>,
}

#[derive(Debug)]
pub struct DailyReminderBatch {
    pub claims: Vec<DailyReminderClaim>,
    pub next_cursor: Option<Uuid>,
}

/// Claim due players without recording delivery. Expired leases are reclaimed
/// by the existing Jobs/Compute tick, including after a worker restart.
/// A crash after delivery but before acknowledgement can duplicate delivery:
/// this is at-least-once, not exactly-once. Rollback must drain this executor
/// or forward-fix it; old executors ignore leases. Additive fields stay put.
pub async fn claim_due_daily_reminders(
    pool: &PgPool,
    now: DateTime<Utc>,
    product_day: &str,
) -> Result<Vec<DailyReminderClaim>, String> {
    Ok(
        claim_due_daily_reminders_after(pool, now, product_day, None)
            .await?
            .claims,
    )
}

/// Advance over every candidate so released failures cannot starve later
/// pages this tick.
pub async fn claim_due_daily_reminders_after(
    pool: &PgPool,
    now: DateTime<Utc>,
    product_day: &str,
    after: Option<Uuid>,
) -> Result<DailyReminderBatch, String> {
    let token = Uuid::now_v7();
    let rows: Vec<(Option<Uuid>, Option<NaiveDate>, Uuid)> = sqlx::query_as(
        r#"
        WITH candidates AS MATERIALIZED (
            SELECT np.user_id, local.local_now::date AS local_date
            FROM notification_preferences np
            LEFT JOIN pg_timezone_names z ON z.name = np.timezone
            CROSS JOIN LATERAL (
                SELECT $1::timestamptz AT TIME ZONE COALESCE(z.name, 'UTC') AS local_now
            ) local
            WHERE np.push_enabled AND np.push_daily_reminder
              AND ($7::uuid IS NULL OR np.user_id > $7)
              AND np.daily_reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              AND floor(extract(epoch FROM local.local_now::time) / 60)
                  BETWEEN extract(epoch FROM np.daily_reminder_time::time) / 60
                      AND extract(epoch FROM np.daily_reminder_time::time) / 60 + $3::int
              AND np.last_daily_reminder_on IS DISTINCT FROM local.local_now::date
              AND (np.daily_reminder_lease_until IS NULL OR np.daily_reminder_lease_until <= $1)
              AND NOT EXISTS (
                  SELECT 1 FROM game_sessions gs
                  WHERE gs.user_id = np.user_id AND gs.day_key = $2
                    AND gs.is_ritual AND gs.status IN ('won', 'lost')
              )
            ORDER BY np.user_id
            LIMIT $4
            FOR UPDATE OF np SKIP LOCKED
        ), claimed AS (
        UPDATE notification_preferences np
        SET daily_reminder_claim_token = $5,
            daily_reminder_claim_on = candidates.local_date,
            daily_reminder_lease_until = $1 + make_interval(secs => $6)
        FROM candidates
        WHERE np.user_id = candidates.user_id
        RETURNING np.user_id, candidates.local_date
        )
        SELECT claimed.user_id, claimed.local_date, page.last_user_id
        FROM (SELECT user_id AS last_user_id FROM candidates ORDER BY user_id DESC LIMIT 1) page
        LEFT JOIN claimed ON true
        ORDER BY claimed.user_id
        "#,
    )
    .bind(now)
    .bind(product_day)
    .bind(REMINDER_GRACE_MINUTES)
    .bind(REMINDER_CLAIM_BATCH)
    .bind(token)
    .bind(REMINDER_LEASE_SECONDS as f64)
    .bind(after)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("daily reminder claim failed: {e}"))?;
    let next_cursor = rows.first().map(|(_, _, cursor)| *cursor);
    let claims = rows
        .into_iter()
        .filter_map(|(uid, day, _)| {
            Some(DailyReminderClaim {
                user_id: uid?.to_string(),
                local_day: day?,
                token,
                lease_until: now + Duration::seconds(REMINDER_LEASE_SECONDS),
            })
        })
        .collect();
    Ok(DailyReminderBatch {
        claims,
        next_cursor,
    })
}

/// Only the still-live token/day owner may acknowledge successful delivery.
/// An expired or replaced worker cannot mark a newer claim as delivered.
pub async fn acknowledge_daily_reminder(
    pool: &PgPool,
    claim: &DailyReminderClaim,
    now: DateTime<Utc>,
) -> Result<bool, String> {
    finish_daily_reminder(pool, claim, now, true).await
}

/// Give back only this worker's live lease, preserving the delivered date.
pub async fn release_daily_reminder(
    pool: &PgPool,
    claim: &DailyReminderClaim,
    now: DateTime<Utc>,
) -> Result<bool, String> {
    finish_daily_reminder(pool, claim, now, false).await
}

async fn finish_daily_reminder(
    pool: &PgPool,
    claim: &DailyReminderClaim,
    now: DateTime<Utc>,
    delivered: bool,
) -> Result<bool, String> {
    let uid = Uuid::parse_str(&claim.user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let changed = sqlx::query(
        r#"UPDATE notification_preferences
        SET last_daily_reminder_on = CASE WHEN $5 THEN $3 ELSE last_daily_reminder_on END,
            daily_reminder_claim_token = NULL, daily_reminder_claim_on = NULL,
            daily_reminder_lease_until = NULL
        WHERE user_id = $1 AND daily_reminder_claim_token = $2
          AND daily_reminder_claim_on = $3 AND daily_reminder_lease_until > $4"#,
    )
    .bind(uid)
    .bind(claim.token)
    .bind(claim.local_day)
    .bind(now)
    .bind(delivered)
    .execute(pool)
    .await
    .map_err(|e| format!("daily reminder completion failed: {e}"))?
    .rows_affected();
    Ok(changed == 1)
}

/// Email-opted-in users with no completed session in the last `days` and no
/// win-back email of the given type yet.
pub async fn win_back_targets(
    pool: &PgPool,
    email_type: &str,
    days: i64,
) -> Result<Vec<(String, String)>, String> {
    let cutoff = Utc::now().naive_utc() - Duration::days(days);
    let rows: Vec<(Uuid, String)> = sqlx::query_as(
        r#"
        SELECT udc.user_id, udc.email
        FROM user_display_cache udc
        JOIN notification_preferences np ON np.user_id = udc.user_id
        WHERE np.email_enabled AND np.email_marketing
          AND udc.email IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM game_sessions gs
            WHERE gs.user_id = udc.user_id AND gs.status IN ('won','lost')
              AND gs.completed_at >= $1
          )
          AND NOT EXISTS (
            SELECT 1 FROM win_back_emails wb
            WHERE wb.user_id = udc.user_id AND wb.email_type = $2::win_back_email_type
          )
        "#,
    )
    .bind(cutoff)
    .bind(email_type)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("win-back targets failed: {e}"))?;
    Ok(rows
        .into_iter()
        .map(|(uid, email)| (uid.to_string(), email))
        .collect())
}

/// Record a sent win-back email (idempotency for the target query).
pub async fn record_win_back_email(
    pool: &PgPool,
    user_id: &str,
    email_type: &str,
    date: NaiveDate,
) -> Result<(), String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    sqlx::query(
        r#"
        INSERT INTO win_back_emails (user_id, email_type, sent_at)
        VALUES ($1, $2::win_back_email_type, $3)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(uid)
    .bind(email_type)
    .bind(date.and_hms_opt(0, 0, 0).ok_or("invalid date")?)
    .execute(pool)
    .await
    .map_err(|e| format!("win-back record failed: {e}"))?;
    Ok(())
}

/// Days an audit row keeps the requester's IP address and user agent.
pub const AUDIT_NETWORK_DATA_DAYS: i32 = 30;
/// Days an audit row is kept at all.
pub const AUDIT_ROW_DAYS: i32 = 365;

/// Audit-log retention: strip IP and user agent after
/// [`AUDIT_NETWORK_DATA_DAYS`], delete rows after [`AUDIT_ROW_DAYS`].
/// Returns (rows stripped, rows deleted).
pub async fn purge_audit_logs(pool: &PgPool) -> Result<(u64, u64), String> {
    let stripped = sqlx::query(
        r#"
        UPDATE audit_logs SET ip_address = NULL, user_agent = NULL
        WHERE created_at < now() - make_interval(days => $1)
          AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)
        "#,
    )
    .bind(AUDIT_NETWORK_DATA_DAYS)
    .execute(pool)
    .await
    .map_err(|e| format!("audit network-data purge failed: {e}"))?
    .rows_affected();
    let deleted = sqlx::query(
        r#"DELETE FROM audit_logs WHERE created_at < now() - make_interval(days => $1)"#,
    )
    .bind(AUDIT_ROW_DAYS)
    .execute(pool)
    .await
    .map_err(|e| format!("audit row purge failed: {e}"))?
    .rows_affected();
    Ok((stripped, deleted))
}

/// Run the audit-log retention at start-up and then once a day. It is
/// idempotent, so several replicas running it is harmless; the JobsService
/// `audit-log-retention` job runs the same purge on demand.
pub fn spawn_audit_log_retention(pool: Option<PgPool>) -> Option<tokio::task::JoinHandle<()>> {
    let pool = pool?;
    Some(tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(24 * 60 * 60));
        loop {
            interval.tick().await;
            match purge_audit_logs(&pool).await {
                Ok((stripped, deleted)) => {
                    tracing::info!(stripped, deleted, "audit-log retention ran");
                }
                Err(error) => tracing::warn!(%error, "audit-log retention failed"),
            }
        }
    }))
}
