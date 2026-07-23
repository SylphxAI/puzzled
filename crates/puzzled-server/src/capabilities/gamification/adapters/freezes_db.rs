//! SQL adapters for streak freeze persistence.

use sqlx::PgPool;
use uuid::Uuid;

/// Load freezes available for a user (0 when missing).
pub async fn load_freezes_available(pool: &PgPool, user_id: &str) -> Result<i32, String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| e.to_string())?;
    let row: Option<(i32,)> =
        sqlx::query_as("SELECT freezes_available FROM user_freeze_data WHERE user_id = $1 LIMIT 1")
            .bind(uid)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    Ok(row.map(|r| r.0).unwrap_or(0))
}

/// Upsert freeze counters for a user.
pub async fn upsert_freeze_data(
    pool: &PgPool,
    user_id: &str,
    freezes_available: i32,
    freezes_used: i32,
    auto_freeze_enabled: bool,
) -> Result<(), String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| e.to_string())?;
    sqlx::query(
        r#"
        INSERT INTO user_freeze_data (user_id, freezes_available, freezes_used, auto_freeze_enabled, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (user_id) DO UPDATE SET
            freezes_available = EXCLUDED.freezes_available,
            freezes_used = EXCLUDED.freezes_used,
            auto_freeze_enabled = EXCLUDED.auto_freeze_enabled,
            updated_at = now()
        "#,
    )
    .bind(uid)
    .bind(freezes_available)
    .bind(freezes_used)
    .bind(auto_freeze_enabled)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
