//! SQL adapters for the admin operations surface.

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

type AnnouncementRow = (
    Uuid,
    String,
    String,
    String,
    bool,
    chrono::DateTime<chrono::Utc>,
    chrono::DateTime<chrono::Utc>,
);
type AnnouncementUpdateRow = (
    String,
    String,
    String,
    bool,
    chrono::DateTime<chrono::Utc>,
    chrono::DateTime<chrono::Utc>,
);
type AuditRow = (
    Uuid,
    Option<Uuid>,
    String,
    String,
    Option<String>,
    Option<Value>,
    chrono::DateTime<chrono::Utc>,
);
type AuditGetRow = (
    Option<Uuid>,
    String,
    String,
    Option<String>,
    Option<Value>,
    chrono::DateTime<chrono::Utc>,
);
type DlqRow = (
    Uuid,
    String,
    Option<Value>,
    String,
    i32,
    String,
    chrono::DateTime<chrono::Utc>,
    Option<chrono::DateTime<chrono::Utc>>,
);

pub async fn list_announcements(pool: &PgPool) -> Result<Vec<Value>, String> {
    let rows: Vec<AnnouncementRow> = sqlx::query_as(
            r#"
            SELECT id, title, content, type::text, is_active, created_at, updated_at
            FROM announcements ORDER BY created_at DESC
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("announcements list failed: {e}"))?;
    Ok(rows
        .into_iter()
        .map(|(id, title, content, typ, is_active, created_at, updated_at)| {
            serde_json::json!({
                "id": id.to_string(),
                "title": title,
                "body": content,
                "type": typ,
                "active": is_active,
                "createdAt": created_at.to_rfc3339(),
                "updatedAt": updated_at.to_rfc3339(),
            })
        })
        .collect())
}

pub async fn create_announcement(
    pool: &PgPool,
    title: &str,
    body: &str,
    typ: &str,
    active: bool,
    actor_id: &str,
) -> Result<Value, String> {
    let actor = Uuid::parse_str(actor_id).map_err(|e| format!("invalid actor id: {e}"))?;
    let row: (Uuid, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
        r#"
        INSERT INTO announcements (title, content, type, is_active, created_by)
        VALUES ($1, $2, $3::announcement_type, $4, $5)
        RETURNING id, created_at
        "#,
    )
    .bind(title)
    .bind(body)
    .bind(typ)
    .bind(active)
    .bind(actor)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("announcement insert failed: {e}"))?;
    Ok(serde_json::json!({
        "id": row.0.to_string(),
        "title": title,
        "body": body,
        "type": typ,
        "active": active,
        "createdAt": row.1.to_rfc3339(),
        "updatedAt": row.1.to_rfc3339(),
    }))
}

pub async fn update_announcement(
    pool: &PgPool,
    id: &str,
    title: Option<&str>,
    body: Option<&str>,
    typ: Option<&str>,
    active: Option<bool>,
) -> Result<Value, String> {
    let id = Uuid::parse_str(id).map_err(|e| format!("invalid announcement id: {e}"))?;
    let row: Option<AnnouncementUpdateRow> = sqlx::query_as(
            r#"
            UPDATE announcements SET
                title = COALESCE($2, title),
                content = COALESCE($3, content),
                type = COALESCE($4::announcement_type, type),
                is_active = COALESCE($5, is_active),
                updated_at = now()
            WHERE id = $1
            RETURNING title, content, type::text, is_active, created_at, updated_at
            "#,
        )
        .bind(id)
        .bind(title)
        .bind(body)
        .bind(typ)
        .bind(active)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("announcement update failed: {e}"))?;
    row.map(|(title, content, typ, is_active, created_at, updated_at)| {
        serde_json::json!({
            "id": id.to_string(),
            "title": title,
            "body": content,
            "type": typ,
            "active": is_active,
            "createdAt": created_at.to_rfc3339(),
            "updatedAt": updated_at.to_rfc3339(),
        })
    })
    .ok_or_else(|| "announcement not found".to_string())
}

pub async fn delete_announcement(pool: &PgPool, id: &str) -> Result<bool, String> {
    let id = Uuid::parse_str(id).map_err(|e| format!("invalid announcement id: {e}"))?;
    let result = sqlx::query("DELETE FROM announcements WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("announcement delete failed: {e}"))?;
    Ok(result.rows_affected() > 0)
}

pub async fn list_settings(pool: &PgPool) -> Result<Vec<Value>, String> {
    let rows: Vec<(String, Value, Option<String>, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        r#"
        SELECT key, value, description, updated_at FROM app_settings ORDER BY key
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("settings list failed: {e}"))?;
    Ok(rows
        .into_iter()
        .map(|(key, value, description, updated_at)| {
            serde_json::json!({
                "key": key,
                "value": value,
                "description": description,
                "updatedAt": updated_at.to_rfc3339(),
            })
        })
        .collect())
}

pub async fn upsert_setting(
    pool: &PgPool,
    key: &str,
    value: &Value,
    actor_id: &str,
) -> Result<Value, String> {
    let actor = Uuid::parse_str(actor_id).map_err(|e| format!("invalid actor id: {e}"))?;
    sqlx::query(
        r#"
        INSERT INTO app_settings (key, value, updated_by, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = now()
        "#,
    )
    .bind(key)
    .bind(value)
    .bind(actor)
    .execute(pool)
    .await
    .map_err(|e| format!("setting upsert failed: {e}"))?;
    Ok(serde_json::json!({ "key": key, "value": value }))
}

pub async fn list_audit_logs(
    pool: &PgPool,
    limit: u32,
    offset: u32,
    action: Option<&str>,
) -> Result<(Vec<Value>, u32), String> {
    let total: (i64,) = match action {
        Some(action) => sqlx::query_as("SELECT COUNT(*) FROM audit_logs WHERE action::text = $1")
            .bind(action)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("audit count failed: {e}"))?,
        None => sqlx::query_as("SELECT COUNT(*) FROM audit_logs")
            .fetch_one(pool)
            .await
            .map_err(|e| format!("audit count failed: {e}"))?,
    };
    let rows: Vec<AuditRow> = match action {
        Some(action) => sqlx::query_as(
            r#"
            SELECT id, user_id, action::text, resource_type, resource_id, metadata, created_at
            FROM audit_logs WHERE action::text = $1
            ORDER BY created_at DESC LIMIT $2 OFFSET $3
            "#,
        )
        .bind(action)
        .bind(i64::from(limit))
        .bind(i64::from(offset))
        .fetch_all(pool)
        .await
        .map_err(|e| format!("audit list failed: {e}"))?,
        None => sqlx::query_as(
            r#"
            SELECT id, user_id, action::text, resource_type, resource_id, metadata, created_at
            FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2
            "#,
        )
        .bind(i64::from(limit))
        .bind(i64::from(offset))
        .fetch_all(pool)
        .await
        .map_err(|e| format!("audit list failed: {e}"))?,
    };
    let entries = rows
        .into_iter()
        .map(
            |(id, user_id, action, resource_type, resource_id, metadata, created_at)| {
                serde_json::json!({
                    "id": id.to_string(),
                    "userId": user_id.map(|u| u.to_string()),
                    "action": action,
                    "entityType": resource_type,
                    "entityId": resource_id,
                    "metadataJson": metadata.map(|m| m.to_string()),
                    "createdAt": created_at.to_rfc3339(),
                })
            },
        )
        .collect();
    Ok((entries, total.0.max(0) as u32))
}

pub async fn get_audit_log(pool: &PgPool, id: &str) -> Result<Value, String> {
    let id = Uuid::parse_str(id).map_err(|e| format!("invalid audit id: {e}"))?;
    let row: Option<AuditGetRow> = sqlx::query_as(
        r#"
        SELECT user_id, action::text, resource_type, resource_id, metadata, created_at
        FROM audit_logs WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("audit get failed: {e}"))?;
    row.map(|(user_id, action, resource_type, resource_id, metadata, created_at)| {
        serde_json::json!({
            "id": id.to_string(),
            "userId": user_id.map(|u| u.to_string()),
            "action": action,
            "entityType": resource_type,
            "entityId": resource_id,
            "metadataJson": metadata.map(|m| m.to_string()),
            "createdAt": created_at.to_rfc3339(),
        })
    })
    .ok_or_else(|| "audit entry not found".to_string())
}

pub async fn list_dlq(pool: &PgPool, limit: u32, offset: u32) -> Result<(Vec<Value>, u32), String> {
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM dead_letter_queue")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("dlq count failed: {e}"))?;
    let rows: Vec<DlqRow> = sqlx::query_as(
        r#"
        SELECT id, workflow_name, payload, status::text, retry_count, error, created_at, last_retry_at
        FROM dead_letter_queue ORDER BY created_at DESC LIMIT $1 OFFSET $2
        "#,
    )
    .bind(i64::from(limit))
    .bind(i64::from(offset))
    .fetch_all(pool)
    .await
    .map_err(|e| format!("dlq list failed: {e}"))?;
    let entries = rows
        .into_iter()
        .map(
            |(id, workflow_name, payload, status, retry_count, error, created_at, last_retry_at)| {
                serde_json::json!({
                    "id": id.to_string(),
                    "jobType": workflow_name,
                    "payloadJson": payload.map(|p| p.to_string()),
                    "status": status,
                    "attempts": retry_count,
                    "error": error,
                    "createdAt": created_at.to_rfc3339(),
                    "nextRetryAt": last_retry_at.map(|t| t.to_rfc3339()),
                })
            },
        )
        .collect();
    Ok((entries, total.0.max(0) as u32))
}

pub async fn dlq_retry(pool: &PgPool, id: &str) -> Result<bool, String> {
    let id = Uuid::parse_str(id).map_err(|e| format!("invalid dlq id: {e}"))?;
    let result = sqlx::query(
        r#"
        UPDATE dead_letter_queue
        SET status = 'retrying', retry_count = retry_count + 1, last_retry_at = now()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| format!("dlq retry failed: {e}"))?;
    Ok(result.rows_affected() > 0)
}

pub async fn dlq_resolve(pool: &PgPool, id: &str) -> Result<bool, String> {
    let id = Uuid::parse_str(id).map_err(|e| format!("invalid dlq id: {e}"))?;
    let result = sqlx::query(
        r#"
        UPDATE dead_letter_queue SET status = 'resolved', resolved_at = now() WHERE id = $1
        "#,
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| format!("dlq resolve failed: {e}"))?;
    Ok(result.rows_affected() > 0)
}

pub async fn dlq_mark_failed(pool: &PgPool, id: &str) -> Result<bool, String> {
    let id = Uuid::parse_str(id).map_err(|e| format!("invalid dlq id: {e}"))?;
    let result = sqlx::query("UPDATE dead_letter_queue SET status = 'failed' WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("dlq mark-failed failed: {e}"))?;
    Ok(result.rows_affected() > 0)
}

pub async fn games_overview(pool: &PgPool) -> Result<Vec<Value>, String> {
    let rows: Vec<(String, i64, i64, i64, i64)> = sqlx::query_as(
        r#"
        SELECT game_slug,
               COUNT(*) FILTER (WHERE completed_at::date = CURRENT_DATE) AS today_played,
               COUNT(*) FILTER (WHERE completed_at::date = CURRENT_DATE AND status = 'won') AS today_wins,
               COUNT(*) AS all_time_played,
               COUNT(*) FILTER (WHERE status = 'won') AS all_time_wins
        FROM game_sessions
        WHERE status IN ('won','lost')
        GROUP BY game_slug
        ORDER BY game_slug
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("games overview failed: {e}"))?;
    Ok(rows
        .into_iter()
        .map(|(slug, today_played, today_wins, all_played, all_wins)| {
            serde_json::json!({
                "slug": slug,
                "todayPlayed": today_played,
                "todayWins": today_wins,
                "allTimePlayed": all_played,
                "allTimeWins": all_wins,
            })
        })
        .collect())
}
