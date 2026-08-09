//! SQL adapter for the server-authoritative puzzle store (daily_puzzles).

use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

type PuzzleRow = (
    Uuid,
    String,
    serde_json::Value,
    Option<serde_json::Value>,
    Option<String>,
);

/// A stored puzzle row: client-facing data (no solution) + server solution.
#[derive(Debug, Clone)]
pub struct StoredPuzzle {
    pub id: Uuid,
    pub game_slug: String,
    pub puzzle_data: serde_json::Value,
    pub solution: Option<serde_json::Value>,
    pub difficulty: Option<String>,
}

fn row_to_puzzle(
    id: Uuid,
    game_slug: String,
    puzzle_data: serde_json::Value,
    solution: Option<serde_json::Value>,
    difficulty: Option<String>,
) -> StoredPuzzle {
    StoredPuzzle {
        id,
        game_slug,
        puzzle_data,
        solution,
        difficulty,
    }
}

/// Fetch the daily puzzle for a game/date/difficulty (difficulty optional).
pub async fn fetch_daily_puzzle(
    pool: &PgPool,
    game_slug: &str,
    date: NaiveDate,
    difficulty: Option<&str>,
) -> Result<Option<StoredPuzzle>, String> {
    let date = date.and_hms_opt(0, 0, 0).ok_or("invalid date")?;
    let row: Option<PuzzleRow> =
        match difficulty {
            Some(diff) => sqlx::query_as(
                r#"
                SELECT id, game_slug, puzzle_data, solution, difficulty::text
                FROM daily_puzzles
                WHERE game_slug = $1 AND puzzle_date = $2 AND difficulty::text = $3
                ORDER BY created_at DESC
                LIMIT 1
                "#,
            )
            .bind(game_slug)
            .bind(date)
            .bind(diff)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("daily_puzzles query failed: {e}"))?,
            None => sqlx::query_as(
                r#"
                SELECT id, game_slug, puzzle_data, solution, difficulty::text
                FROM daily_puzzles
                WHERE game_slug = $1 AND puzzle_date = $2
                ORDER BY created_at DESC
                LIMIT 1
                "#,
            )
            .bind(game_slug)
            .bind(date)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("daily_puzzles query failed: {e}"))?,
        };
    Ok(row.map(|(id, slug, data, sol, diff)| row_to_puzzle(id, slug, data, sol, diff)))
}

/// Fetch a puzzle by id (daily or archive).
pub async fn fetch_puzzle_by_id(
    pool: &PgPool,
    puzzle_id: &str,
) -> Result<Option<StoredPuzzle>, String> {
    let id = Uuid::parse_str(puzzle_id).map_err(|e| format!("invalid puzzle id: {e}"))?;
    let row: Option<PuzzleRow> =
        sqlx::query_as(
            r#"
            SELECT id, game_slug, puzzle_data, solution, difficulty::text
            FROM daily_puzzles
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("daily_puzzles query failed: {e}"))?;
    Ok(row.map(|(i, slug, data, sol, diff)| row_to_puzzle(i, slug, data, sol, diff)))
}
