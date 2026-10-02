//! Daily puzzle generation: one deterministic generator per game.
//!
//! Every game has a pure generator here, so the server can make any product
//! day's puzzle itself, store it ahead of time, and backfill the archive (the
//! pipeline lives in `puzzled-server`, capability `daily_pipeline`).
//!
//! - **Seed:** `YYYYMMDD` of the product day, plus 0/1/2 for easy/medium/hard,
//!   the same rule as the TS content tool (`registry.server.ts`), so a stored
//!   puzzle can be regenerated for audit (the crossword's new days use
//!   `rust-crossword-v2`; see Versions).
//! - **Parity:** each port reproduces its TS generator byte for byte where TS
//!   succeeds (`tests/fixtures/generate/*.json`, exported by
//!   `apps/puzzled/scripts/export-generator-fixtures.ts`).
//! - **Never gives up:** where a TS generator throws for a seed (crowns,
//!   killer-sudoku), the port keeps trying derived seeds, so every day gets a
//!   puzzle.
//! - **Self-check:** before a puzzle is accepted, the game's own submission
//!   validator must accept its solution (`self_check`).
//! - **Versions:** every stored row records the generator that made it
//!   ([`GENERATOR_V1`], [`GENERATOR_CROSSWORD_V2`]). A stored row is never
//!   replaced, so each version keeps reproducing its own output; new rows use
//!   the game's current version. [`generate_seeded`] is the V1 entry point.

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

/// The generator every game used before crossword V2, and still the one for
/// every game but the crossword.
pub const GENERATOR_V1: &str = "rust-v1";
/// Crossword whose down clues describe the column words
/// (`domain::crossword_v2`).
pub const GENERATOR_CROSSWORD_V2: &str = "rust-crossword-v2";

/// The generator version new rows of a game are made with.
#[must_use]
fn current_generator_version(game_slug: &str) -> &'static str {
    match super::domain::game_slugs::canonicalize_game_slug(game_slug) {
        "crossword" => GENERATOR_CROSSWORD_V2,
        _ => GENERATOR_V1,
    }
}

/// A generated puzzle ready to store.
#[derive(Debug, Clone, PartialEq)]
pub struct Generated {
    pub puzzle_data: Value,
    pub solution: Value,
    pub seed: i64,
    /// The generator that made it; stored on the row as `generator_version`.
    pub generator_version: &'static str,
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

/// Generate from an explicit seed with the V1 generators (parity tests use the
/// TS seeds directly; the pipeline uses it for days before it started).
pub fn generate_seeded(
    game_slug: &str,
    seed: i64,
    difficulty: Option<&str>,
) -> Result<(Value, Value), String> {
    generate_seeded_as(GENERATOR_V1, game_slug, seed, difficulty)
}

/// Generate from an explicit seed with the named generator version. An
/// unknown version, or one that does not belong to the game, is an error, so a
/// stored row can always be reproduced by the generator that made it.
fn generate_seeded_as(
    version: &str,
    game_slug: &str,
    seed: i64,
    difficulty: Option<&str>,
) -> Result<(Value, Value), String> {
    use super::domain::{
        crossword_generate::generate_crossword_puzzle, crossword_v2::generate_crossword_puzzle_v2,
        queens_generate::try_generate_queens_puzzle_with_size, sudoku::generate_sudoku_puzzle,
        word_groups_generate::generate_word_groups_puzzle,
        word_guess_generate::generate_word_guess_puzzle,
    };
    use crate::SudokuDifficulty;
    let slug = super::domain::game_slugs::canonicalize_game_slug(game_slug);
    match (version, slug) {
        (GENERATOR_V1, _) => {}
        (GENERATOR_CROSSWORD_V2, "crossword") => {
            return Ok(generate_crossword_puzzle_v2(seed));
        }
        _ => return Err(format!("no generator version {version} for {slug}")),
    }
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
        // The grid the player submits is the solution grid.
        "crossword" => serde_json::json!({ "finalGrid": solution.get("grid") }),
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
        // Rows made before crossword V2 carry down clues that describe the row
        // words, which are wrong where a column spells another word. They are
        // hidden (the grid, across clues and scoring are unchanged); the board
        // plays across-only.
        "crossword" => hide_wrong_down_clues(map, solution),
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

/// Empty `clues.down` of a crossword row whose down clues do not describe its
/// columns. A V2 row (`clueSet == "rows-columns"`) is left alone, and so is a
/// V1 row whose columns all spell the row words (the clues are then right).
fn hide_wrong_down_clues(map: &mut serde_json::Map<String, Value>, solution: &Value) {
    use super::domain::crossword_v2::CLUE_SET_ROWS_COLUMNS;
    if map.get("clueSet").and_then(Value::as_str) == Some(CLUE_SET_ROWS_COLUMNS) {
        return;
    }
    let rows: Vec<Vec<&str>> = solution
        .get("grid")
        .and_then(Value::as_array)
        .map(|grid| {
            grid.iter()
                .map(|row| {
                    row.as_array()
                        .map(|cells| cells.iter().filter_map(Value::as_str).collect())
                        .unwrap_or_default()
                })
                .collect()
        })
        .unwrap_or_default();
    let columns_match_rows = !rows.is_empty()
        && (0..rows.len()).all(|col| {
            let column: String = rows.iter().filter_map(|r| r.get(col).copied()).collect();
            column == rows[col].concat()
        });
    if columns_match_rows {
        return;
    }
    if let Some(down) = map
        .get_mut("clues")
        .and_then(Value::as_object_mut)
        .and_then(|clues| clues.get_mut("down"))
    {
        *down = Value::Array(Vec::new());
    }
}

/// The product day's puzzle for a game and difficulty, made by the game's
/// current generator and self-checked.
pub fn generate(
    game_slug: &str,
    date: NaiveDate,
    difficulty: Option<&str>,
) -> Result<Generated, String> {
    let slug = super::domain::game_slugs::canonicalize_game_slug(game_slug);
    let seed = seed_for(date, difficulty);
    let generator_version = current_generator_version(slug);
    let (puzzle_data, solution) = generate_seeded_as(generator_version, slug, seed, difficulty)?;
    self_check(slug, &puzzle_data, &solution)?;
    Ok(Generated {
        puzzle_data,
        solution,
        seed,
        generator_version,
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

    #[test]
    fn crossword_v1_rows_hide_down_clues_unless_columns_spell_the_rows() {
        // HEART is a symmetric square: its down clues are right and stay.
        let (heart_data, heart_solution) = generate_seeded("crossword", 0, None).unwrap();
        assert_eq!(heart_solution["grid"][0][0], "H");
        let served = served_payload("crossword", &heart_data, &heart_solution);
        assert_eq!(served["clues"]["down"].as_array().map(Vec::len), Some(5));

        // Seed 1 is the STARE square: its columns spell other words.
        let (data, solution) = generate_seeded("crossword", 1, None).unwrap();
        let served = served_payload("crossword", &data, &solution);
        assert_eq!(served["clues"]["down"], serde_json::json!([]));
        // Grid, across clues and the solution are untouched.
        assert_eq!(served["grid"], data["grid"]);
        assert_eq!(served["clues"]["across"], data["clues"]["across"]);
    }

    #[test]
    fn crossword_v2_rows_are_served_whole() {
        let (data, solution) =
            generate_seeded_as(GENERATOR_CROSSWORD_V2, "crossword", 1, None).unwrap();
        assert_eq!(served_payload("crossword", &data, &solution), data);
        assert_eq!(data["clues"]["down"].as_array().map(Vec::len), Some(5));
    }

    #[test]
    fn new_rows_use_the_current_generator_and_old_versions_still_reproduce() {
        let day = NaiveDate::from_ymd_opt(2026, 10, 16).unwrap_or_default();
        let made = generate("crossword", day, None).unwrap();
        assert_eq!(made.generator_version, GENERATOR_CROSSWORD_V2);
        assert_eq!(made.puzzle_data["clueSet"], "rows-columns");
        // Every other game stays on V1.
        let other = generate("word-guess", day, None).unwrap();
        assert_eq!(other.generator_version, GENERATOR_V1);
        // The V1 version reproduces its stored output for a future day too.
        let v1 = generate_seeded_as(GENERATOR_V1, "crossword", made.seed, None).unwrap();
        assert_eq!(v1, generate_seeded("crossword", made.seed, None).unwrap());
        assert!(v1.0.get("clueSet").is_none());
        // A version that does not belong to the game is refused.
        assert!(generate_seeded_as(GENERATOR_CROSSWORD_V2, "sudoku", 1, None).is_err());
        assert!(generate_seeded_as("rust-v0", "crossword", 1, None).is_err());
    }

    #[test]
    fn every_v2_board_passes_the_crossword_self_check() {
        let n = crate::puzzle_play::crossword_v2::board_count() as i64;
        for seed in 0..n {
            let (data, solution) =
                generate_seeded_as(GENERATOR_CROSSWORD_V2, "crossword", seed, None).unwrap();
            self_check("crossword", &data, &solution).unwrap();
        }
        // The V1 pool passes too.
        let (data, solution) = generate_seeded("crossword", 3, None).unwrap();
        self_check("crossword", &data, &solution).unwrap();
    }
}
