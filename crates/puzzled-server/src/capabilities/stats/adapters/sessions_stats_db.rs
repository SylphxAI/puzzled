//! SQL adapters for user stats and history (server-authoritative sessions).

use puzzled_core::identity_policy::guest_day_id::user_id_to_storage_uuid;
use puzzled_core::puzzle_play::ritual_completion::{DRC_MODULE_COMPLETIONS_SQL, DRC_RECOMPUTE_SQL};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

fn parse_user_id(user_id: &str) -> Result<Uuid, String> {
    user_id_to_storage_uuid(user_id).ok_or_else(|| format!("invalid user id: {user_id}"))
}

// HistoryRow mirrors game_sessions columns: score/time_spent_ms are INT4
// nullable in Postgres. Decode as Option<i32> (never i64): bare INT4
// decoded as INT8 fails with history_read_failed (live P1 observability).
type HistoryRow = (
    Option<Uuid>,
    Option<chrono::NaiveDateTime>,
    String,
    Option<i32>,
    i32,
    Option<i32>,
    String,
    String,
);

/// Per-game aggregates for a user.
pub async fn user_stats(pool: &PgPool, user_id: &str) -> Result<(Vec<Value>, u32, u32), String> {
    let uid = parse_user_id(user_id)?;
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
    let uid = parse_user_id(user_id)?;
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
                    "score": score.unwrap_or(0).max(0) as u32,
                    "attempts": attempts.max(0) as u32,
                    "timeSpentMs": time_spent_ms.unwrap_or(0).max(0) as u64,
                    "mode": mode,
                })
            },
        )
        .collect())
}

/// Public today overview: daily puzzle completers + qualifying ritual
/// finishes for the bound product `day_key`. Same authority as `compute_drc`.
pub async fn today_overview(
    pool: &PgPool,
    day_key: &str,
) -> Result<(u32, Vec<serde_json::Value>), String> {
    let players: (i64,) = sqlx::query_as(DRC_RECOMPUTE_SQL)
        .bind(day_key)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("today players failed: {e}"))?;
    let rows: Vec<(String, i64)> = sqlx::query_as(DRC_MODULE_COMPLETIONS_SQL)
        .bind(day_key)
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
    use super::parse_user_id;
    use puzzled_core::puzzle_play::game_slugs::ModuleClass;
    use puzzled_core::puzzle_play::ritual_completion::{
        compute_drc, compute_today_overview, RitualCompletionRow, RitualOverviewRow,
    };

    #[test]
    fn guest_logical_user_id_maps_to_storage_uuid() {
        let uid = parse_user_id("guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890").expect("guest");
        assert_eq!(uid.to_string(), "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        let platform = parse_user_id("f715210b-9df3-4945-b5bd-94fc4609bc30").expect("platform");
        assert_eq!(platform.to_string(), "f715210b-9df3-4945-b5bd-94fc4609bc30");
        assert!(parse_user_id("not-a-uuid").is_err());
    }

    #[test]
    fn today_overview_player_count_equals_compute_drc() {
        let rows = [RitualOverviewRow {
            user_id: "a".into(),
            day_key: "2026-08-22".into(),
            game_module_id: "sudoku".into(),
            module_class: ModuleClass::PuzzleRitual,
            is_ritual: true,
        }];
        let overview = compute_today_overview("2026-08-22", &rows);
        let drc_rows: Vec<RitualCompletionRow> =
            rows.iter().map(RitualOverviewRow::completion_row).collect();
        assert_eq!(overview.player_count, compute_drc("2026-08-22", &drc_rows));
        assert_eq!(overview.player_count, 1);
    }
}
