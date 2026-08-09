//! SQL adapters for user stats and history (server-authoritative sessions).

use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

type HistoryRow = (
    Option<Uuid>,
    Option<chrono::NaiveDateTime>,
    String,
    i32,
    i32,
    i64,
    String,
    String,
);

/// Per-game aggregates for a user.
pub async fn user_stats(pool: &PgPool, user_id: &str) -> Result<(Vec<Value>, u32, u32), String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let rows: Vec<(String, i64, i64, Option<i32>)> = sqlx::query_as(
        r#"
        SELECT game_slug,
               COUNT(*) AS games_played,
               COUNT(*) FILTER (WHERE status = 'won') AS games_won,
               MAX(score) AS best_score
        FROM game_sessions
        WHERE user_id = $1 AND status IN ('won','lost')
        GROUP BY game_slug
        ORDER BY game_slug
        "#,
    )
    .bind(uid)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("user stats failed: {e}"))?;
    let mut total_played: i64 = 0;
    let mut total_won: i64 = 0;
    let games: Vec<Value> = rows
        .into_iter()
        .map(|(slug, played, won, best)| {
            total_played += played;
            total_won += won;
            serde_json::json!({
                "gameSlug": slug,
                "gamesPlayed": played,
                "gamesWon": won,
                "bestScore": best.unwrap_or(0).max(0) as u32,
            })
        })
        .collect();
    Ok((games, total_played.max(0) as u32, total_won.max(0) as u32))
}

/// Recent completed sessions for a user (optional game filter).
pub async fn user_history(
    pool: &PgPool,
    user_id: &str,
    game_slug: Option<&str>,
    limit: u32,
) -> Result<Vec<Value>, String> {
    let uid = Uuid::parse_str(user_id).map_err(|e| format!("invalid user id: {e}"))?;
    let limit = limit.clamp(1, 100) as i64;
    let rows: Vec<HistoryRow> = match game_slug {
        Some(slug) => sqlx::query_as(
            r#"
            SELECT puzzle_id, puzzle_date, status::text, score, attempts, time_spent_ms, mode::text, game_slug
            FROM game_sessions
            WHERE user_id = $1 AND game_slug = $2 AND status IN ('won','lost')
            ORDER BY completed_at DESC LIMIT $3
            "#,
        )
        .bind(uid)
        .bind(slug)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("history query failed: {e}"))?,
        None => sqlx::query_as(
            r#"
            SELECT puzzle_id, puzzle_date, status::text, score, attempts, time_spent_ms, mode::text, game_slug
            FROM game_sessions
            WHERE user_id = $1 AND status IN ('won','lost')
            ORDER BY completed_at DESC LIMIT $2
            "#,
        )
        .bind(uid)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("history query failed: {e}"))?,
    };
    Ok(rows
        .into_iter()
        .map(
            |(puzzle_id, puzzle_date, status, score, attempts, time_spent_ms, mode, slug)| {
                serde_json::json!({
                    "gameSlug": slug,
                    "puzzleId": puzzle_id.map(|p| p.to_string()),
                    "puzzleDate": puzzle_date.map(|d| d.format("%Y-%m-%d").to_string()),
                    "status": status,
                    "score": score.max(0) as u32,
                    "attempts": attempts.max(0) as u32,
                    "timeSpentMs": time_spent_ms.max(0) as u64,
                    "mode": mode,
                })
            },
        )
        .collect())
}
