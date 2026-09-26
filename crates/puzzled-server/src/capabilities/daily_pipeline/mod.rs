//! Daily puzzle pipeline: every game has a stored, validated puzzle for every
//! product day, made ahead of time (issue #246).
//!
//! - **Generate:** `puzzled_core::puzzle_play::generate` (pure, seeded,
//!   self-checked against each game's own validator).
//! - **Store:** `daily_puzzles`, one row per (game, day, difficulty); a row is
//!   never overwritten, so a served puzzle never changes.
//! - **Schedule:** [`fill`] stores [`DAYS_AHEAD`] days ahead and backfills the
//!   archive window. It runs at start-up and on a Compute schedule tick.
//! - **Serve:** [`resolve`] reads the stored row and, on a miss, generates and
//!   stores it first, so a player never waits on the schedule.
//! - **Alert:** a fill that leaves fewer than [`ALERT_BELOW_DAYS`] days stored
//!   ahead for any game reports an error to Observability.
//!
//! The five games the server generated before the pipeline (sudoku,
//! crossword, word-groups, word-guess, crowns) keep their original seeds for
//! every day before [`PIPELINE_START`], so a puzzle already served or finished
//! is never replaced.

use chrono::{Duration, NaiveDate};
use serde_json::Value;
use sqlx::PgPool;
use tracing::{info, warn};

use puzzled_core::puzzle_play::daily_time::get_puzzle_number;
use puzzled_core::puzzle_play::game_slugs::{all_game_slugs, canonicalize_game_slug};
use puzzled_core::puzzle_play::generate::{self, difficulties_for, Generated, DIFFICULTY_GAMES};

pub mod store;

/// Days stored ahead of today.
pub const DAYS_AHEAD: i64 = 14;
/// Past days kept playable (the archive window, `archive-days.ts`).
pub const ARCHIVE_DAYS: i64 = 30;
/// Alert when fewer days than this are stored ahead for any game.
pub const ALERT_BELOW_DAYS: i64 = 3;
/// Generator version recorded on each row.
pub const GENERATOR_VERSION: &str = "rust-v1";

/// First product day generated with the pipeline seed for the five games the
/// server already generated before it.
pub const PIPELINE_START: (i32, u32, u32) = (2026, 9, 28);

const LEGACY_GAMES: [&str; 5] = ["sudoku", "crossword", "word-groups", "word-guess", "crowns"];

fn pipeline_start() -> NaiveDate {
    let (y, m, d) = PIPELINE_START;
    NaiveDate::from_ymd_opt(y, m, d).unwrap_or(NaiveDate::MIN)
}

/// The difficulty a row is stored under: difficulty games default to medium,
/// other games have none.
#[must_use]
pub fn stored_difficulty<'a>(game_slug: &str, requested: Option<&'a str>) -> Option<&'a str> {
    if !DIFFICULTY_GAMES.contains(&game_slug) {
        return None;
    }
    match requested.map(str::trim) {
        Some(d @ ("easy" | "medium" | "hard")) => Some(d),
        _ => Some("medium"),
    }
}

/// Generate one game's puzzle for a product day (pure; CPU-bound).
pub fn generate_for(
    game_slug: &str,
    date: NaiveDate,
    difficulty: Option<&str>,
) -> Result<Generated, String> {
    let slug = canonicalize_game_slug(game_slug);
    if LEGACY_GAMES.contains(&slug) && date < pipeline_start() {
        // The seed these five games were served with before the pipeline.
        let seed = i64::from(get_puzzle_number(date, None));
        let (puzzle_data, solution) = generate::generate_seeded(slug, seed, difficulty)?;
        return Ok(Generated {
            puzzle_data,
            solution,
            seed,
        });
    }
    generate::generate(slug, date, difficulty)
}

/// A puzzle ready to serve or grade.
#[derive(Debug, Clone)]
pub struct Resolved {
    pub puzzle_data: Value,
    pub solution: Value,
    /// The stored row id; None only without a database.
    pub id: Option<String>,
}

/// The stored puzzle for (game, day, difficulty), generating and storing it
/// on a miss. Without a database the puzzle is generated and not stored.
pub async fn resolve(
    pool: Option<&PgPool>,
    game_slug: &str,
    date: NaiveDate,
    difficulty: Option<&str>,
) -> Result<Resolved, String> {
    let slug = canonicalize_game_slug(game_slug).to_string();
    let difficulty = stored_difficulty(&slug, difficulty).map(str::to_string);
    if let Some(pool) = pool {
        if let Some(found) = store::fetch(pool, &slug, date, difficulty.as_deref()).await? {
            return Ok(found);
        }
    }
    let generated = {
        let slug = slug.clone();
        let difficulty = difficulty.clone();
        tokio::task::spawn_blocking(move || generate_for(&slug, date, difficulty.as_deref()))
            .await
            .map_err(|e| format!("generator task failed: {e}"))??
    };
    let Some(pool) = pool else {
        return Ok(Resolved {
            puzzle_data: generated.puzzle_data,
            solution: generated.solution,
            id: None,
        });
    };
    store::insert(pool, &slug, date, difficulty.as_deref(), &generated).await?;
    // Read back: a concurrent request may have stored the row first.
    store::fetch(pool, &slug, date, difficulty.as_deref())
        .await?
        .ok_or_else(|| format!("{slug} {date}: stored puzzle not found after insert"))
}

/// Outcome of one fill run.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct FillReport {
    pub generated: u32,
    pub failed: Vec<String>,
    /// Fewest consecutive days stored from today onward, over every game and
    /// difficulty.
    pub min_days_ahead: i64,
}

/// Store every missing puzzle from `today - ARCHIVE_DAYS` to
/// `today + DAYS_AHEAD`, then measure the buffer and alert when it is low.
pub async fn fill(pool: &PgPool, today: NaiveDate) -> Result<FillReport, String> {
    let ahead = fill_range(pool, today, today + Duration::days(DAYS_AHEAD), today).await?;
    // The archive after the days ahead: players need today and tomorrow first.
    let archive = fill_range(pool, today - Duration::days(ARCHIVE_DAYS), today, today).await?;
    let mut report = archive;
    report.generated += ahead.generated;
    report.failed.extend(ahead.failed);
    alert_if_low(&report);
    info!(
        generated = report.generated,
        failed = report.failed.len(),
        min_days_ahead = report.min_days_ahead,
        "daily puzzle fill ran"
    );
    Ok(report)
}

/// Store every missing puzzle in `[from, to]`, then measure the buffer from
/// `today`.
pub async fn fill_range(
    pool: &PgPool,
    from: NaiveDate,
    to: NaiveDate,
    today: NaiveDate,
) -> Result<FillReport, String> {
    let mut report = FillReport {
        min_days_ahead: i64::MAX,
        ..FillReport::default()
    };
    for slug in all_game_slugs() {
        let existing = store::existing(pool, slug, from, to).await?;
        for difficulty in difficulties_for(slug) {
            let mut day = from;
            while day <= to {
                let key = (day, difficulty.map(str::to_string));
                if !existing.contains(&key) {
                    let (slug_owned, diff_owned) =
                        (slug.to_string(), difficulty.map(str::to_string));
                    let result = tokio::task::spawn_blocking(move || {
                        generate_for(&slug_owned, day, diff_owned.as_deref())
                    })
                    .await
                    .map_err(|e| format!("generator task failed: {e}"))?;
                    match result {
                        Ok(generated) => {
                            store::insert(pool, slug, day, difficulty, &generated).await?;
                            report.generated += 1;
                        }
                        Err(error) => {
                            warn!(%error, slug, %day, ?difficulty, "daily puzzle generation failed");
                            report
                                .failed
                                .push(format!("{slug} {day} {difficulty:?}: {error}"));
                        }
                    }
                }
                day += Duration::days(1);
            }
        }
    }
    report.min_days_ahead =
        store::min_days_ahead(pool, today, today + Duration::days(DAYS_AHEAD)).await?;
    Ok(report)
}

fn alert_if_low(report: &FillReport) {
    if report.min_days_ahead < ALERT_BELOW_DAYS || !report.failed.is_empty() {
        crate::observability::capture(crate::observability::ErrorReport {
            exception_type: "DailyPuzzleBufferLow".into(),
            message: format!(
                "daily puzzle buffer: {} day(s) stored ahead (alert below {ALERT_BELOW_DAYS}); {} generation failure(s)",
                report.min_days_ahead,
                report.failed.len()
            ),
            route: Some("daily-pipeline".into()),
            tags: std::iter::once(("job".into(), "daily-puzzles".into()))
                .chain(
                    (!report.failed.is_empty())
                        .then(|| ("failed".into(), report.failed.join("\n").chars().take(1000).collect())),
                )
                .collect(),
            ..crate::observability::ErrorReport::default()
        });
    }
}

/// Run [`fill`] once at start-up, off the request path.
pub fn spawn_startup_fill(pool: Option<PgPool>) -> Option<tokio::task::JoinHandle<()>> {
    let pool = pool?;
    Some(tokio::spawn(async move {
        let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
        if let Err(error) = fill(&pool, today).await {
            warn!(%error, "daily puzzle fill at start-up failed");
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn difficulty_is_normalised_per_game() {
        assert_eq!(stored_difficulty("sudoku", None), Some("medium"));
        assert_eq!(stored_difficulty("sudoku", Some("hard")), Some("hard"));
        assert_eq!(stored_difficulty("sudoku", Some("insane")), Some("medium"));
        assert_eq!(stored_difficulty("word-hive", Some("hard")), None);
    }

    #[test]
    fn legacy_games_keep_their_seed_before_the_pipeline_starts() {
        let before = NaiveDate::from_ymd_opt(2026, 9, 26).unwrap_or_default();
        let legacy = generate_for("word-guess", before, None).map(|g| g.seed);
        assert_eq!(legacy, Ok(i64::from(get_puzzle_number(before, None))));
        let after = pipeline_start();
        assert_eq!(
            generate_for("word-guess", after, None).map(|g| g.seed),
            Ok(20_260_928)
        );
    }
}
