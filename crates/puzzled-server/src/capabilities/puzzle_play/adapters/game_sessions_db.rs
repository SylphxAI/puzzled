//! SQL adapter for puzzle-play game session persistence.

use sqlx::PgPool;

use puzzled_core::puzzle_play::game_flows::{GameMode, SaveResultPlan};

#[derive(Debug, Clone)]
pub struct PersistGameSessionInput<'a> {
    pub user_id: &'a str,
    pub score: Option<i32>,
    pub plan: &'a SaveResultPlan,
}

/// Insert a completed/abandoned game session row. Returns session id.
pub async fn persist_game_session(
    pool: &PgPool,
    input: PersistGameSessionInput<'_>,
) -> Result<String, String> {
    let uid = uuid::Uuid::parse_str(input.user_id).map_err(|e| format!("invalid user id: {e}"))?;
    // DB enum game_status: in_progress|won|lost|abandoned
    let status = input.plan.status.as_str();
    // DB enum game_mode: daily|archive (practice maps to daily for storage)
    let mode = match input.plan.mode {
        GameMode::Archive => "archive",
        GameMode::Daily | GameMode::Practice => "daily",
    };
    let row: (uuid::Uuid,) = sqlx::query_as(
        r#"
        INSERT INTO game_sessions (
            user_id, game_slug, difficulty, mode, status, score, attempts, time_spent_ms, completed_at
        ) VALUES (
            $1, $2,
            $3::puzzle_difficulty,
            $4::game_mode,
            $5::game_status,
            $6, $7, $8,
            now()
        )
        RETURNING id
        "#,
    )
    .bind(uid)
    .bind(&input.plan.game_slug)
    .bind(input.plan.difficulty.as_deref())
    .bind(mode)
    .bind(status)
    .bind(input.score)
    .bind(input.plan.attempts as i32)
    .bind(input.plan.time_spent_ms as i32)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("game_sessions insert failed: {e}"))?;
    Ok(row.0.to_string())
}
