//! SQL adapter for puzzle-play game session persistence.
//!
//! Ritual completion (`ritual.completed` equivalent) is stored on the same
//! authoritative `game_sessions` row written after server validation — no dual
//! instrumentation path.

use sqlx::PgPool;

use puzzled_core::puzzle_play::game_flows::{GameMode, SaveResultPlan};
use puzzled_core::puzzle_play::ritual_completion::{
    build_ritual_completed, qualifies_as_ritual, RitualQualifyInput, DRC_RECOMPUTE_SQL,
};

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
///
/// When the finish qualifies as a ritual, also writes `day_key`, `module_class`,
/// `is_ritual`, and `finish_kind` on the same row (sole instrumentation path).
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
    day_key: Option<chrono::NaiveDate>,
    at_ms: i64,
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

    let ritual = if qualifies_as_ritual(RitualQualifyInput {
        game_module_id: game_slug,
        mode,
        status,
        is_dry_run: false,
    }) {
        let dk = day_key.ok_or("day_key required for ritual completion")?;
        build_ritual_completed(
            user_id,
            game_slug,
            dk,
            status,
            puzzle_id.map(str::to_string),
            at_ms,
        )
    } else {
        None
    };

    let (day_key_str, module_class, is_ritual, finish_kind) = match &ritual {
        Some(r) => (
            Some(r.day_key.as_str()),
            Some(r.module_class.as_str()),
            true,
            Some(r.finish_kind.as_str()),
        ),
        None => (None, None, false, None),
    };

    let row: Option<(uuid::Uuid,)> = sqlx::query_as(
        r#"
        INSERT INTO game_sessions (
            user_id, game_slug, puzzle_id, puzzle_date, difficulty, mode, status,
            score, attempts, time_spent_ms, completed_at,
            day_key, module_class, is_ritual, finish_kind
        ) VALUES (
            $1, $2, $3, $4,
            $5::puzzle_difficulty,
            $6::game_mode,
            $7::game_status,
            $8, $9, $10,
            now(),
            $11, $12, $13, $14
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
    .bind(day_key_str)
    .bind(module_class)
    .bind(is_ritual)
    .bind(finish_kind)
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

/// Recompute DRC for a product day_key from `game_sessions` (live oracle).
pub async fn recompute_drc(pool: &PgPool, day_key: &str) -> Result<u64, String> {
    let row: (i64,) = sqlx::query_as(DRC_RECOMPUTE_SQL)
        .bind(day_key)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("drc recompute failed: {e}"))?;
    Ok(row.0.max(0) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use puzzled_core::puzzle_play::ritual_completion::FinishKind;

    #[test]
    fn ritual_fields_derived_for_daily_won() {
        let day = chrono::NaiveDate::from_ymd_opt(2026, 8, 12).expect("d");
        assert!(qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "daily",
            status: "won",
            is_dry_run: false,
        }));
        let ev =
            build_ritual_completed("u1", "sudoku", day, "won", Some("p1".into()), 0).expect("ev");
        assert_eq!(ev.finish_kind, FinishKind::Success);
        assert_eq!(ev.day_key, "2026-08-12");
        assert!(ev.is_ritual);
    }
}
