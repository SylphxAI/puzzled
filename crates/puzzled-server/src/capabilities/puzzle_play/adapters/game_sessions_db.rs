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

/// True when the user has a completed session for the given puzzle/date.
pub async fn has_completed_session(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    puzzle_date: Option<chrono::NaiveDate>,
    puzzle_id: Option<&str>,
) -> Result<bool, String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let pid = match puzzle_id {
        Some(p) => Some(uuid::Uuid::parse_str(p).map_err(|e| format!("invalid puzzle id: {e}"))?),
        None => None,
    };
    let date = match puzzle_date {
        Some(d) => Some(d.and_hms_opt(0, 0, 0).ok_or("invalid date")?),
        None => None,
    };
    let row: Option<(i64,)> = match (pid, date) {
        (Some(pid), _) => sqlx::query_as(
            r#"
            SELECT 1 FROM game_sessions
            WHERE user_id = $1 AND puzzle_id = $2 AND status IN ('won','lost')
            LIMIT 1
            "#,
        )
        .bind(uid)
        .bind(pid)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("game_sessions query failed: {e}"))?,
        (None, Some(date)) => sqlx::query_as(
            r#"
            SELECT 1 FROM game_sessions
            WHERE user_id = $1 AND game_slug = $2 AND puzzle_date = $3
              AND status IN ('won','lost')
            LIMIT 1
            "#,
        )
        .bind(uid)
        .bind(game_slug)
        .bind(date)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("game_sessions query failed: {e}"))?,
        (None, None) => None,
    };
    Ok(row.is_some())
}

/// Persist a server-validated result (authoritative path from Connect submit).
#[allow(clippy::too_many_arguments)]
pub async fn persist_validated_session(
    pool: &PgPool,
    user_id: &str,
    game_slug: &str,
    difficulty: Option<&str>,
    mode: &str,
    status: &str,
    score: Option<i32>,
    attempts: u32,
    time_spent_ms: u64,
    puzzle_id: Option<&str>,
    puzzle_date: Option<chrono::NaiveDate>,
) -> Result<String, String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let pid = match puzzle_id {
        Some(p) => Some(uuid::Uuid::parse_str(p).map_err(|e| format!("invalid puzzle id: {e}"))?),
        None => None,
    };
    let date = match puzzle_date {
        Some(d) => Some(d.and_hms_opt(0, 0, 0).ok_or("invalid date")?),
        None => None,
    };
    let row: Option<(uuid::Uuid,)> = sqlx::query_as(
        r#"
        INSERT INTO game_sessions (
            user_id, game_slug, puzzle_id, puzzle_date, difficulty, mode, status,
            score, attempts, time_spent_ms, completed_at
        ) VALUES (
            $1, $2, $3, $4,
            $5::puzzle_difficulty,
            $6::game_mode,
            $7::game_status,
            $8, $9, $10,
            now()
        )
        ON CONFLICT (user_id, puzzle_id) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(uid)
    .bind(game_slug)
    .bind(pid)
    .bind(date)
    .bind(difficulty)
    .bind(mode)
    .bind(status)
    .bind(score)
    .bind(attempts as i32)
    .bind(time_spent_ms as i32)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("game_sessions insert failed: {e}"))?;
    Ok(row.map_or_else(String::new, |(id,)| id.to_string()))
}

/// Count a user's completed sessions (any game).
pub async fn count_sessions(pool: &PgPool, user_id: &str) -> Result<u32, String> {
    let uid = uuid::Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM game_sessions WHERE user_id = $1 AND status IN ('won','lost')",
    )
    .bind(uid)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("session count failed: {e}"))?;
    Ok(row.0.max(0) as u32)
}
