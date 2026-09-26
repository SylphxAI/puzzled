//! Daily puzzle generation: one deterministic generator per game.
//!
//! Every game has a pure generator here, so the server can make any product
//! day's puzzle itself, store it ahead of time, and backfill the archive (the
//! pipeline lives in `puzzled-server`, capability `daily_pipeline`).
//!
//! - **Seed:** `YYYYMMDD` of the product day, plus 0/1/2 for easy/medium/hard,
//!   the same rule as the TS content tool (`registry.server.ts`), so a stored
//!   puzzle can be regenerated for audit.
//! - **Parity:** each port reproduces its TS generator byte for byte where TS
//!   succeeds (`tests/fixtures/generate/*.json`, exported by
//!   `apps/puzzled/scripts/export-generator-fixtures.ts`).
//! - **Never gives up:** where a TS generator throws for a seed (crowns,
//!   killer-sudoku), the port keeps trying derived seeds, so every day gets a
//!   puzzle.
//! - **Self-check:** before a puzzle is accepted, the game's own submission
//!   validator must accept its solution (`self_check`).

use chrono::{Datelike, NaiveDate};
use serde_json::Value;

use super::application::submission_validation::{validate_submission, SubmissionEnvelope};
use super::domain::scoring::SubmissionStatus;

pub mod arithmo;
pub mod block_slide;
pub mod cryptogram;
pub mod duo;
pub mod killer_sudoku;
pub mod nonogram;
pub mod number_path;
pub mod pattern_match;
pub mod pip_place;
pub mod quad_words;
pub mod word_box;
pub mod word_hive;
pub mod word_ladder;
pub mod word_search;

/// Games with a daily difficulty choice (one puzzle per difficulty per day).
pub const DIFFICULTY_GAMES: [&str; 5] = [
    "block-slide",
    "crowns",
    "killer-sudoku",
    "nonogram",
    "sudoku",
];

/// Difficulties of a difficulty game, in seed-offset order.
pub const DIFFICULTIES: [&str; 3] = ["easy", "medium", "hard"];

/// A generated puzzle ready to store.
#[derive(Debug, Clone, PartialEq)]
pub struct Generated {
    pub puzzle_data: Value,
    pub solution: Value,
    pub seed: i64,
}

/// The difficulties stored for a game each day: three, or one `None`.
#[must_use]
pub fn difficulties_for(game_slug: &str) -> Vec<Option<&'static str>> {
    if DIFFICULTY_GAMES.contains(&game_slug) {
        DIFFICULTIES.iter().map(|d| Some(*d)).collect()
    } else {
        vec![None]
    }
}

/// Content-pipeline seed: `YYYYMMDD` + 0/1/2 for easy/medium/hard.
#[must_use]
pub fn seed_for(date: NaiveDate, difficulty: Option<&str>) -> i64 {
    let base =
        i64::from(date.year()) * 10_000 + i64::from(date.month()) * 100 + i64::from(date.day());
    base + match difficulty {
        Some("medium") => 1,
        Some("hard") => 2,
        _ => 0,
    }
}

/// Generate from an explicit seed (parity tests use the TS seeds directly).
pub fn generate_seeded(
    game_slug: &str,
    seed: i64,
    difficulty: Option<&str>,
) -> Result<(Value, Value), String> {
    use super::domain::{
        crossword_generate::generate_crossword_puzzle,
        queens_generate::try_generate_queens_puzzle_with_size, sudoku::generate_sudoku_puzzle,
        word_groups_generate::generate_word_groups_puzzle,
        word_guess_generate::generate_word_guess_puzzle,
    };
    use crate::SudokuDifficulty;
    let slug = super::domain::game_slugs::canonicalize_game_slug(game_slug);
    match slug {
        "sudoku" => {
            let d = match difficulty {
                Some("easy") => SudokuDifficulty::Easy,
                Some("hard") => SudokuDifficulty::Hard,
                _ => SudokuDifficulty::Medium,
            };
            let r = generate_sudoku_puzzle(seed, d);
            let data = serde_json::to_value(&r.puzzle_data).map_err(|e| e.to_string())?;
            let solution = serde_json::to_value(&r.solution).map_err(|e| e.to_string())?;
            Ok((data, solution))
        }
        "crowns" => {
            let size = match difficulty {
                Some("easy") => 5,
                Some("hard") => 8,
                _ => 6,
            };
            try_generate_queens_puzzle_with_size(seed, size)
        }
        "crossword" => Ok(generate_crossword_puzzle(seed)),
        "word-groups" => Ok(generate_word_groups_puzzle(seed)),
        "word-guess" => Ok(generate_word_guess_puzzle(seed)),
        "arithmo" => arithmo::generate(seed, difficulty),
        "block-slide" => block_slide::generate(seed, difficulty),
        "cryptogram" => cryptogram::generate(seed, difficulty),
        "duo" => duo::generate(seed, difficulty),
        "killer-sudoku" => killer_sudoku::generate(seed, difficulty),
        "nonogram" => nonogram::generate(seed, difficulty),
        "number-path" => number_path::generate(seed, difficulty),
        "pattern-match" => pattern_match::generate(seed, difficulty),
        "pip-place" => pip_place::generate(seed, difficulty),
        "quad-words" => quad_words::generate(seed, difficulty),
        "word-box" => word_box::generate(seed, difficulty),
        "word-hive" => word_hive::generate(seed, difficulty),
        "word-ladder" => word_ladder::generate(seed, difficulty),
        "word-search" => word_search::generate(seed, difficulty),
        other => Err(format!("no generator for {other}")),
    }
}

/// The solution as the submission the game's validator grades, where the
/// game defines one.
fn solution_submission(game_slug: &str, solution: &Value) -> Option<Value> {
    Some(match game_slug {
        "arithmo" => arithmo::solution_submission(solution),
        "block-slide" => block_slide::solution_submission(solution),
        "cryptogram" => cryptogram::solution_submission(solution),
        "duo" => duo::solution_submission(solution),
        "killer-sudoku" => killer_sudoku::solution_submission(solution),
        "nonogram" => nonogram::solution_submission(solution),
        "number-path" => number_path::solution_submission(solution),
        "pattern-match" => pattern_match::solution_submission(solution),
        "pip-place" => pip_place::solution_submission(solution),
        "quad-words" => quad_words::solution_submission(solution),
        "word-box" => word_box::solution_submission(solution),
        "word-hive" => word_hive::solution_submission(solution),
        "word-ladder" => word_ladder::solution_submission(solution),
        "word-search" => word_search::solution_submission(solution),
        _ => return None,
    })
}

/// The game's own validator must accept the generator's solution as a win.
pub fn self_check(game_slug: &str, puzzle_data: &Value, solution: &Value) -> Result<(), String> {
    let Some(submission) = solution_submission(game_slug, solution) else {
        return Ok(());
    };
    let verdict = validate_submission(
        game_slug,
        puzzle_data,
        solution,
        &SubmissionEnvelope {
            status: SubmissionStatus::Won,
            attempts: 1,
            time_spent_ms: 60_000,
            data: submission,
        },
    );
    if verdict.valid && verdict.status == Some(SubmissionStatus::Won) {
        Ok(())
    } else {
        Err(format!(
            "{game_slug}: validator refused the generated solution: {}",
            verdict.error.unwrap_or_else(|| "not a win".to_string())
        ))
    }
}

/// What the player is served: the stored puzzle data plus the public parts of
/// the solution a game needs to be played. Word-search shows the list of words
/// to find (their positions stay secret).
#[must_use]
pub fn served_payload(game_slug: &str, puzzle_data: &Value, solution: &Value) -> Value {
    let mut served = puzzle_data.clone();
    let Some(map) = served.as_object_mut() else {
        return served;
    };
    match game_slug {
        "word-search" => {
            if let Some(words) = solution.get("words") {
                map.insert("words".to_string(), words.clone());
            }
        }
        // The stored data is the four answers; the board needs none of it.
        "quad-words" => {
            map.remove("words");
        }
        // The valid words and pangrams are the answers: serve their counts.
        "word-hive" => {
            let count = |key: &str| {
                map.get(key)
                    .and_then(Value::as_array)
                    .map(|a| Value::from(a.len()))
            };
            let (words, pangrams) = (count("validWords"), count("pangrams"));
            map.remove("validWords");
            map.remove("pangrams");
            if let Some(n) = words {
                map.insert("totalWords".to_string(), n);
            }
            if let Some(n) = pangrams {
                map.insert("totalPangrams".to_string(), n);
            }
        }
        _ => {}
    }
    served
}

/// The product day's puzzle for a game and difficulty, self-checked.
pub fn generate(
    game_slug: &str,
    date: NaiveDate,
    difficulty: Option<&str>,
) -> Result<Generated, String> {
    let slug = super::domain::game_slugs::canonicalize_game_slug(game_slug);
    let seed = seed_for(date, difficulty);
    let (puzzle_data, solution) = generate_seeded(slug, seed, difficulty)?;
    self_check(slug, &puzzle_data, &solution)?;
    Ok(Generated {
        puzzle_data,
        solution,
        seed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_search_serves_its_word_list_but_not_the_positions() {
        let data = serde_json::json!({"grid": [["A"]], "theme": "t", "wordCount": 1});
        let solution = serde_json::json!({"words": ["A"], "placements": [{"word": "A"}]});
        let served = served_payload("word-search", &data, &solution);
        assert_eq!(served["words"], serde_json::json!(["A"]));
        assert!(served.get("placements").is_none());
        assert_eq!(served_payload("sudoku", &data, &solution), data);
    }

    #[test]
    fn seeds_follow_the_content_pipeline_rule() {
        let day = NaiveDate::from_ymd_opt(2026, 9, 26).unwrap_or_default();
        assert_eq!(seed_for(day, None), 20_260_926);
        assert_eq!(seed_for(day, Some("easy")), 20_260_926);
        assert_eq!(seed_for(day, Some("medium")), 20_260_927);
        assert_eq!(seed_for(day, Some("hard")), 20_260_928);
        assert_eq!(difficulties_for("sudoku").len(), 3);
        assert_eq!(difficulties_for("word-hive"), vec![None]);
    }
}
