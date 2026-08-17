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

/// Public today overview: daily puzzle completers + qualifying ritual finishes
/// for the current product day. This is the same server-written authority as
/// the North Star recompute; it must not fall back to wall-clock finish counts.
const TODAY_OVERVIEW_PLAYERS_SQL: &str = r#"
SELECT COUNT(DISTINCT user_id) FROM game_sessions
WHERE is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won','lost')
  AND day_key = ((now() AT TIME ZONE 'Asia/Hong_Kong')::date)::text
"#;

const TODAY_OVERVIEW_COMPLETIONS_SQL: &str = r#"
SELECT game_slug, COUNT(DISTINCT user_id) FROM game_sessions
WHERE is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won','lost')
  AND day_key = ((now() AT TIME ZONE 'Asia/Hong_Kong')::date)::text
GROUP BY game_slug ORDER BY game_slug
"#;

pub async fn today_overview(pool: &PgPool) -> Result<(u32, Vec<serde_json::Value>), String> {
    let players: (i64,) = sqlx::query_as(TODAY_OVERVIEW_PLAYERS_SQL)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("today players failed: {e}"))?;
    let rows: Vec<(String, i64)> = sqlx::query_as(TODAY_OVERVIEW_COMPLETIONS_SQL)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("today completions failed: {e}"))?;
    let completions = rows
        .into_iter()
        .map(|(slug, count)| serde_json::json!({ "gameSlug": slug, "count": count }))
        .collect();
    Ok((players.0.max(0) as u32, completions))
}

#[cfg(test)]
mod tests {
    use super::{TODAY_OVERVIEW_COMPLETIONS_SQL, TODAY_OVERVIEW_PLAYERS_SQL};

    #[test]
    fn today_overview_uses_product_day_ritual_authority() {
        for query in [TODAY_OVERVIEW_PLAYERS_SQL, TODAY_OVERVIEW_COMPLETIONS_SQL] {
            assert!(query.contains("is_ritual = true"));
            assert!(query.contains("module_class = 'puzzle_ritual'"));
            assert!(query.contains("day_key"));
            assert!(query.contains("Asia/Hong_Kong"));
            assert!(!query.contains("CURRENT_DATE"));
            assert!(!query.contains("completed_at::date"));
        }
        assert!(TODAY_OVERVIEW_COMPLETIONS_SQL.contains("COUNT(DISTINCT user_id)"));
    }
}
