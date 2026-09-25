//! SQL adapters for retention job targeting.

use chrono::{Duration, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Users opted into push with the daily reminder flag.
pub async fn daily_reminder_targets(pool: &PgPool) -> Result<Vec<(String, String)>, String> {
    let rows: Vec<(Uuid, String)> = sqlx::query_as(
        r#"
        SELECT np.user_id, COALESCE(np.daily_reminder_time, '09:00')
        FROM notification_preferences np
        WHERE np.push_enabled AND np.push_daily_reminder
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("daily reminder targets failed: {e}"))?;
    Ok(rows
        .into_iter()
        .map(|(uid, time)| (uid.to_string(), time))
        .collect())
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
