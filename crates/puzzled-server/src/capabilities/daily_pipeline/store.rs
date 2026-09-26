//! `daily_puzzles` SQL for the pipeline. Rows are only ever inserted; a
//! stored puzzle is never replaced. `difficulty` is NULL for games without a
//! difficulty choice, so matching uses `IS NOT DISTINCT FROM` (the unique
//! index does not cover NULLs).

use std::collections::HashSet;

use chrono::{Duration, NaiveDate, NaiveDateTime};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use puzzled_core::puzzle_play::game_slugs::all_game_slugs;
use puzzled_core::puzzle_play::generate::{difficulties_for, Generated};

use super::{Resolved, GENERATOR_VERSION};

fn midnight(date: NaiveDate) -> NaiveDateTime {
    date.and_hms_opt(0, 0, 0).unwrap_or_default()
}

/// The stored puzzle for exactly (game, day, difficulty).
pub async fn fetch(
    pool: &PgPool,
    game_slug: &str,
    date: NaiveDate,
    difficulty: Option<&str>,
) -> Result<Option<Resolved>, String> {
    let row: Option<(Uuid, Value, Option<Value>)> = sqlx::query_as(
        r#"SELECT id, puzzle_data, solution FROM daily_puzzles
           WHERE game_slug = $1 AND puzzle_date = $2
             AND difficulty::text IS NOT DISTINCT FROM $3
           ORDER BY created_at ASC LIMIT 1"#,
    )
    .bind(game_slug)
    .bind(midnight(date))
    .bind(difficulty)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("daily_puzzles read failed: {e}"))?;
    Ok(match row {
        Some((id, puzzle_data, Some(solution))) => Some(Resolved {
            puzzle_data,
            solution,
            id: Some(id.to_string()),
        }),
        // A row without a solution cannot be graded: treat it as missing.
        _ => None,
    })
}

/// Store a generated puzzle unless one exists for (game, day, difficulty).
pub async fn insert(
    pool: &PgPool,
    game_slug: &str,
    date: NaiveDate,
    difficulty: Option<&str>,
    generated: &Generated,
) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO daily_puzzles
             (game_slug, puzzle_date, puzzle_data, solution, difficulty, seed, generator_version)
           SELECT $1, $2, $3, $4, $5::puzzle_difficulty, $6, $7
           WHERE NOT EXISTS (
             SELECT 1 FROM daily_puzzles
             WHERE game_slug = $1 AND puzzle_date = $2
               AND difficulty::text IS NOT DISTINCT FROM $5)
           ON CONFLICT DO NOTHING"#,
    )
    .bind(game_slug)
    .bind(midnight(date))
    .bind(&generated.puzzle_data)
    .bind(&generated.solution)
    .bind(difficulty)
    .bind(i32::try_from(generated.seed).ok())
    .bind(GENERATOR_VERSION)
    .execute(pool)
    .await
    .map_err(|e| format!("daily_puzzles insert failed for {game_slug} {date}: {e}"))?;
    Ok(())
}

/// Stored (day, difficulty) keys for one game in `[from, to]`.
pub async fn existing(
    pool: &PgPool,
    game_slug: &str,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<HashSet<(NaiveDate, Option<String>)>, String> {
    let rows: Vec<(NaiveDateTime, Option<String>)> = sqlx::query_as(
        r#"SELECT puzzle_date, difficulty::text FROM daily_puzzles
           WHERE game_slug = $1 AND puzzle_date BETWEEN $2 AND $3 AND solution IS NOT NULL"#,
    )
    .bind(game_slug)
    .bind(midnight(from))
    .bind(midnight(to))
    .fetch_all(pool)
    .await
    .map_err(|e| format!("daily_puzzles scan failed: {e}"))?;
    Ok(rows.into_iter().map(|(at, d)| (at.date(), d)).collect())
}

/// Fewest consecutive days stored from `today`, over every game and difficulty.
pub async fn min_days_ahead(pool: &PgPool, today: NaiveDate, to: NaiveDate) -> Result<i64, String> {
    let mut min = i64::MAX;
    for slug in all_game_slugs() {
        let stored = existing(pool, slug, today, to).await?;
        for difficulty in difficulties_for(slug) {
            let mut days = 0;
            let mut day = today;
            while day <= to && stored.contains(&(day, difficulty.map(str::to_string))) {
                days += 1;
                day += Duration::days(1);
            }
            min = min.min(days);
        }
    }
    Ok(if min == i64::MAX { 0 } else { min })
}
