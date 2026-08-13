//! Server-authoritative submission validation dispatch (ADR-170).
//!
//! Every game's final submission is validated against the puzzle the server
//! served (stored content or deterministic generation). Solutions never leave
//! the server; clients never supply scores or verdicts.
//!
//! Each adapter mirrors the client's `endGame` data shape (see
//! `apps/puzzled/src/games/*`) and the game's stored solution shape, then
//! delegates to the per-game pure kernel.

use serde::Deserialize;
use serde_json::Value;

use crate::capabilities::puzzle_play::domain::scoring::SubmissionStatus;

/// Full client submission envelope (endGame) passed to validation.
#[derive(Debug, Clone)]
pub struct SubmissionEnvelope {
    pub status: SubmissionStatus,
    pub attempts: u32,
    pub time_spent_ms: u64,
    pub data: Value,
}

/// Common verdict produced by every game adapter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubmissionVerdict {
    pub valid: bool,
    pub status: Option<SubmissionStatus>,
    pub score: Option<u32>,
    pub error: Option<String>,
}

impl SubmissionVerdict {
    fn invalid(error: impl Into<String>) -> Self {
        Self {
            valid: false,
            status: None,
            score: None,
            error: Some(error.into()),
        }
    }

    fn valid(status: SubmissionStatus, score: u32) -> Self {
        Self {
            valid: true,
            status: Some(status),
            score: Some(score),
            error: None,
        }
    }
}

fn status_from_wl(
    status: crate::capabilities::puzzle_play::domain::wordle_eval::SubmissionStatus,
) -> SubmissionStatus {
    match status {
        crate::capabilities::puzzle_play::domain::wordle_eval::SubmissionStatus::Won => {
            SubmissionStatus::Won
        }
        crate::capabilities::puzzle_play::domain::wordle_eval::SubmissionStatus::Lost => {
            SubmissionStatus::Lost
        }
    }
}

/// Validate a final submission for a served puzzle.
///
/// `puzzle_data` and `solution` are the JSON the server holds for the served
/// puzzle (never sent to clients); `submission` is the client's `endGame.data`.
pub fn validate_submission(
    game_slug: &str,
    puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    match crate::capabilities::puzzle_play::domain::game_slugs::canonicalize_game_slug(game_slug) {
        "word-guess" => word_guess(puzzle_data, solution, env),
        "word-groups" => word_groups(puzzle_data, solution, env),
        "word-hive" => word_hive(puzzle_data, solution, env),
        "crossword" => crossword(puzzle_data, solution, env),
        "sudoku" => sudoku(puzzle_data, solution, env),
        "nonogram" => nonogram(puzzle_data, solution, env),
        "word-ladder" => word_ladder(puzzle_data, solution, env),
        "arithmo" => arithmo(puzzle_data, solution, env),
        "pattern-match" => pattern_match(puzzle_data, solution, env),
        "block-slide" => block_slide(puzzle_data, solution, env),
        "crowns" | "queens" => queens(puzzle_data, solution, env),
        "duo" | "tango" => tango(puzzle_data, solution, env),
        "word-box" => word_box(puzzle_data, solution, env),
        "quad-words" => quad_words(puzzle_data, solution, env),
        "killer-sudoku" => killer_sudoku(puzzle_data, solution, env),
        "cryptogram" => cryptogram(puzzle_data, solution, env),
        "word-search" => word_search(puzzle_data, solution, env),
        other => SubmissionVerdict::invalid(format!("unsupported game slug: {other}")),
    }
}

fn claimed_wl(
    status: SubmissionStatus,
) -> crate::capabilities::puzzle_play::domain::wordle_eval::SubmissionStatus {
    match status {
        SubmissionStatus::Won => {
            crate::capabilities::puzzle_play::domain::wordle_eval::SubmissionStatus::Won
        }
        SubmissionStatus::Lost => {
            crate::capabilities::puzzle_play::domain::wordle_eval::SubmissionStatus::Lost
        }
    }
}

// ---------------------------------------------------------------------------
// word-guess (Wordle): solution {word}; submission {guesses: string[]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WordGuessSubmission {
    guesses: Vec<String>,
}

fn word_guess(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::wordle_eval;
    let Ok(sub) = serde_json::from_value::<WordGuessSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing guesses data");
    };
    let Some(word) = solution.get("word").and_then(Value::as_str) else {
        return SubmissionVerdict::invalid("Missing solution word");
    };
    let result =
        wordle_eval::validate_and_score(word, Some(&sub.guesses), claimed_wl(env.status), None);
    match result {
        wordle_eval::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        wordle_eval::GameResult::Valid { status, score } => {
            SubmissionVerdict::valid(status_from_wl(status), score)
        }
    }
}

// ---------------------------------------------------------------------------
// word-groups (Connections): solution {categories:[{name,words,level}]};
// submission {foundCategories: string[][], mistakes: number}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WordGroupsSubmission {
    #[serde(default)]
    found_categories: Option<Vec<Vec<String>>>,
    #[serde(default)]
    mistakes: Option<u32>,
}

fn word_groups(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::word_groups;
    let Ok(sub) = serde_json::from_value::<WordGroupsSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Invalid word-groups submission");
    };
    let Some(cats) = solution.get("categories").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing categories solution");
    };
    let mut categories: Vec<word_groups::Category> = Vec::new();
    for c in cats {
        let Some(name) = c.get("name").and_then(Value::as_str) else {
            return SubmissionVerdict::invalid("Invalid category name");
        };
        let Some(words) = c.get("words").and_then(Value::as_array) else {
            return SubmissionVerdict::invalid("Invalid category words");
        };
        let words: Vec<String> = words
            .iter()
            .filter_map(Value::as_str)
            .map(ToString::to_string)
            .collect();
        let level = c.get("level").and_then(Value::as_u64).unwrap_or(0) as u8;
        categories.push(word_groups::Category {
            name: name.to_string(),
            words,
            level,
        });
    }
    let result = word_groups::validate_and_score(
        &categories,
        sub.found_categories.as_deref(),
        sub.mistakes,
        word_groups::SubmissionStatus::Won,
    );
    match result {
        word_groups::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        word_groups::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                word_groups::SubmissionStatus::Won => SubmissionStatus::Won,
                word_groups::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// word-hive (Spelling Bee): solution {validWords, pangrams};
// submission {foundWords: string[]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WordHiveSubmission {
    found_words: Vec<String>,
}

fn word_hive(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::word_hive;
    let Ok(sub) = serde_json::from_value::<WordHiveSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing found words data");
    };
    let mut valid_words = std::collections::HashSet::new();
    let mut pangrams = std::collections::HashSet::new();
    if let Some(list) = solution.get("validWords").and_then(Value::as_array) {
        for w in list.iter().filter_map(Value::as_str) {
            valid_words.insert(w.to_ascii_uppercase());
        }
    }
    if let Some(list) = solution.get("pangrams").and_then(Value::as_array) {
        for w in list.iter().filter_map(Value::as_str) {
            pangrams.insert(w.to_ascii_uppercase());
        }
    }
    let found: Vec<String> = sub
        .found_words
        .iter()
        .map(|w| w.to_ascii_uppercase())
        .collect();
    let result = word_hive::validate_and_score(&valid_words, &pangrams, Some(&found));
    match result {
        word_hive::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        word_hive::GameResult::Valid { score, .. } => {
            SubmissionVerdict::valid(SubmissionStatus::Won, score)
        }
    }
}

// ---------------------------------------------------------------------------
// crossword: solution {grid: string[][]}; submission {finalGrid: (string|null)[][]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CrosswordSubmission {
    final_grid: Vec<Vec<Option<String>>>,
}

fn crossword(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::crossword_grid;
    let Ok(sub) = serde_json::from_value::<CrosswordSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing final grid data");
    };
    let Some(grid) = solution.get("grid").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing crossword solution grid");
    };
    let mut solution_grid: Vec<Vec<String>> = Vec::new();
    for row in grid {
        let row: Vec<String> = row
            .as_array()
            .map(|cells| {
                cells
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect()
            })
            .unwrap_or_default();
        solution_grid.push(row);
    }
    let result = crossword_grid::validate_and_score(
        &solution_grid,
        Some(&sub.final_grid),
        env.time_spent_ms,
        crossword_grid::SubmissionStatus::Won,
    );
    match result {
        crossword_grid::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        crossword_grid::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                crossword_grid::SubmissionStatus::Won => SubmissionStatus::Won,
                crossword_grid::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// sudoku: solution {grid: number[][]}; submission {finalGrid: (number|null)[][]}
// ---------------------------------------------------------------------------

fn sudoku(_puzzle_data: &Value, solution: &Value, env: &SubmissionEnvelope) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::sudoku_scoring::{
        validate_and_score_sudoku, GameSubmission, ScoringResult, SubmissionStatus as Ss,
    };
    use crate::capabilities::puzzle_play::sudoku::SudokuSolution;
    if !env.data.is_object() {
        return SubmissionVerdict::invalid("Missing final grid data");
    }
    let Some(grid) = solution.get("grid").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing sudoku solution grid");
    };
    let mut solution_grid: Vec<Vec<u8>> = Vec::new();
    for row in grid {
        let row: Vec<u8> = row
            .as_array()
            .map(|cells| {
                cells
                    .iter()
                    .filter_map(Value::as_u64)
                    .map(|v| v as u8)
                    .collect()
            })
            .unwrap_or_default();
        solution_grid.push(row);
    }
    let game_submission = GameSubmission {
        status: match env.status {
            SubmissionStatus::Won => Ss::Won,
            SubmissionStatus::Lost => Ss::Lost,
        },
        attempts: env.attempts,
        time_spent_ms: env.time_spent_ms,
        data: Some(env.data.clone()),
    };
    match validate_and_score_sudoku(
        &SudokuSolution {
            grid: solution_grid,
        },
        &game_submission,
    ) {
        ScoringResult::Valid {
            valid,
            status,
            score,
        } => {
            if !valid {
                SubmissionVerdict::invalid("Invalid sudoku solution")
            } else {
                SubmissionVerdict::valid(
                    match status {
                        Ss::Won => SubmissionStatus::Won,
                        Ss::Lost => SubmissionStatus::Lost,
                    },
                    score,
                )
            }
        }
        ScoringResult::Invalid { valid, error } => {
            let _ = valid;
            SubmissionVerdict::invalid(error)
        }
    }
}

// ---------------------------------------------------------------------------
// nonogram: solution {grid: boolean[][]}; submission {finalGrid: boolean[][]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NonogramSubmission {
    final_grid: Vec<Vec<bool>>,
}

fn nonogram(_puzzle_data: &Value, solution: &Value, env: &SubmissionEnvelope) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::nonogram_clues;
    let Ok(sub) = serde_json::from_value::<NonogramSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing final grid data");
    };
    let Some(grid) = solution.get("grid").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing nonogram solution grid");
    };
    let mut solution_grid: Vec<Vec<bool>> = Vec::new();
    for row in grid {
        let row: Vec<bool> = row
            .as_array()
            .map(|cells| cells.iter().filter_map(Value::as_bool).collect())
            .unwrap_or_default();
        solution_grid.push(row);
    }
    let errors = env.data.get("errors").and_then(Value::as_u64).unwrap_or(0) as u32;
    let result = nonogram_clues::validate_and_score(
        &solution_grid,
        Some(&sub.final_grid),
        errors,
        env.time_spent_ms,
        nonogram_clues::SubmissionStatus::Won,
    );
    match result {
        nonogram_clues::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        nonogram_clues::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                nonogram_clues::SubmissionStatus::Won => SubmissionStatus::Won,
                nonogram_clues::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// word-ladder: solution {path: string[]}; submission {path: string[]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WordLadderSubmission {
    path: Vec<String>,
}

fn word_ladder(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::word_ladder;
    let Ok(sub) = serde_json::from_value::<WordLadderSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing path data");
    };
    let Some(path) = solution.get("path").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing ladder solution path");
    };
    let solution_path: Vec<String> = path
        .iter()
        .filter_map(Value::as_str)
        .map(ToString::to_string)
        .collect();
    let result = word_ladder::validate_and_score(
        &solution_path,
        Some(&sub.path),
        word_ladder::SubmissionStatus::Won,
        None,
    );
    match result {
        word_ladder::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        word_ladder::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                word_ladder::SubmissionStatus::Won => SubmissionStatus::Won,
                word_ladder::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// arithmo: solution {equation: string}; submission {guesses: string[]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArithmoSubmission {
    guesses: Vec<String>,
}

fn arithmo(_puzzle_data: &Value, solution: &Value, env: &SubmissionEnvelope) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::arithmo;
    let Ok(sub) = serde_json::from_value::<ArithmoSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing guesses data");
    };
    let Some(equation) = solution.get("equation").and_then(Value::as_str) else {
        return SubmissionVerdict::invalid("Missing solution equation");
    };
    let result =
        arithmo::validate_and_score(equation, Some(&sub.guesses), arithmo::SubmissionStatus::Won);
    match result {
        arithmo::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        arithmo::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                arithmo::SubmissionStatus::Won => SubmissionStatus::Won,
                arithmo::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// pattern-match: solution {validSets: [n,n,n][], totalSets};
// submission {foundSets: number[][], mistakes: number}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PatternMatchSubmission {
    #[serde(default)]
    found_sets: Option<Vec<Vec<u16>>>,
    #[serde(default)]
    mistakes: Option<u32>,
}

fn pattern_match(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    let Ok(sub) = serde_json::from_value::<PatternMatchSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Invalid pattern-match submission");
    };
    let Some(valid_sets) = solution.get("validSets").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing validSets solution");
    };
    let mut expected: Vec<Vec<u16>> = Vec::new();
    for set in valid_sets {
        let set: Vec<u16> = set
            .as_array()
            .map(|idx| {
                idx.iter()
                    .filter_map(Value::as_u64)
                    .map(|v| v as u16)
                    .collect()
            })
            .unwrap_or_default();
        if set.len() == 3 {
            expected.push(set);
        }
    }
    let Some(found) = sub.found_sets.as_ref() else {
        return SubmissionVerdict::invalid("Missing foundSets data");
    };
    let mistakes = sub.mistakes.unwrap_or(0);
    if mistakes > 4 {
        return SubmissionVerdict::invalid("Too many mistakes");
    }
    let mut seen: std::collections::HashSet<Vec<u16>> = std::collections::HashSet::new();
    for set in found {
        let mut sorted = set.clone();
        sorted.sort_unstable();
        if !expected.iter().any(|e| {
            let mut es = e.clone();
            es.sort_unstable();
            es == sorted
        }) {
            return SubmissionVerdict::invalid("Invalid set found");
        }
        if !seen.insert(sorted) {
            return SubmissionVerdict::invalid("Duplicate set");
        }
    }
    let total = solution
        .get("totalSets")
        .and_then(Value::as_u64)
        .unwrap_or(expected.len() as u64) as usize;
    if found.len() != total {
        return SubmissionVerdict::invalid("Not all sets found");
    }
    SubmissionVerdict::valid(SubmissionStatus::Won, 100)
}

// ---------------------------------------------------------------------------
// block-slide: solution {minMoves}; submission {moveCount: number}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlockSlideSubmission {
    move_count: u32,
}

fn block_slide(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::block_slide;
    let Ok(sub) = serde_json::from_value::<BlockSlideSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing moveCount data");
    };
    let Some(min_moves) = solution.get("minMoves").and_then(Value::as_u64) else {
        return SubmissionVerdict::invalid("Missing minMoves solution");
    };
    let result = block_slide::validate_and_score(
        min_moves as u32,
        Some(sub.move_count),
        env.time_spent_ms,
        block_slide::SubmissionStatus::Won,
    );
    match result {
        block_slide::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        block_slide::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                block_slide::SubmissionStatus::Won => SubmissionStatus::Won,
                block_slide::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// queens: solution {queens: [row,col][]}; puzzleData {size, regions};
// submission {finalGrid: boolean[][]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueensSubmission {
    final_grid: Vec<Vec<bool>>,
}

fn queens(puzzle_data: &Value, solution: &Value, env: &SubmissionEnvelope) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::queens_conflict;
    let Ok(sub) = serde_json::from_value::<QueensSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing final grid data");
    };
    let size = puzzle_data
        .get("size")
        .and_then(Value::as_u64)
        .or_else(|| solution.get("size").and_then(Value::as_u64))
        .unwrap_or(0) as usize;
    if size == 0 {
        return SubmissionVerdict::invalid("Missing queens size");
    }
    let regions = puzzle_data
        .get("regions")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .map(|row| {
                    row.as_array()
                        .map(|cells| {
                            cells
                                .iter()
                                .filter_map(Value::as_i64)
                                .map(|v| v as i32)
                                .collect()
                        })
                        .unwrap_or_default()
                })
                .collect::<Vec<Vec<i32>>>()
        });
    let Some(regions) = regions else {
        return SubmissionVerdict::invalid("Missing queens regions");
    };
    let result = queens_conflict::validate_and_score(
        Some(&sub.final_grid),
        &regions,
        size,
        env.time_spent_ms,
        queens_conflict::SubmissionStatus::Won,
    );
    match result {
        queens_conflict::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        queens_conflict::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                queens_conflict::SubmissionStatus::Won => SubmissionStatus::Won,
                queens_conflict::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// tango: solution {grid: ('sun'|'moon')[][]}; submission {grid: ('sun'|'moon'|null)[][]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TangoSubmission {
    grid: Vec<Vec<Option<String>>>,
}

fn tango(_puzzle_data: &Value, solution: &Value, env: &SubmissionEnvelope) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::tango::{self, CellValue};
    let Ok(sub) = serde_json::from_value::<TangoSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing grid data");
    };
    let Some(grid) = solution.get("grid").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing tango solution grid");
    };
    let parse_cell = |v: Option<&str>| match v {
        Some("sun") => CellValue::Sun,
        Some("moon") => CellValue::Moon,
        _ => CellValue::Empty,
    };
    let solution_grid: Vec<Vec<CellValue>> = grid
        .iter()
        .map(|row| {
            row.as_array()
                .map(|cells| cells.iter().map(|c| parse_cell(c.as_str())).collect())
                .unwrap_or_default()
        })
        .collect();
    let submitted_grid: Vec<Vec<CellValue>> = sub
        .grid
        .iter()
        .map(|row| row.iter().map(|c| parse_cell(c.as_deref())).collect())
        .collect();
    let result = tango::validate_and_score(
        Some(&submitted_grid),
        Some(&solution_grid),
        env.time_spent_ms,
        tango::SubmissionStatus::Won,
    );
    match result {
        tango::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        tango::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                tango::SubmissionStatus::Won => SubmissionStatus::Won,
                tango::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// word-box (Letter Boxed): solution {words, allLetters};
// submission {words: string[]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WordBoxSubmission {
    words: Vec<String>,
}

fn word_box(_puzzle_data: &Value, solution: &Value, env: &SubmissionEnvelope) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::word_box;
    let Ok(sub) = serde_json::from_value::<WordBoxSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing words data");
    };
    let Some(all_letters) = solution.get("allLetters").and_then(Value::as_str) else {
        return SubmissionVerdict::invalid("Missing allLetters solution");
    };
    let letters: Vec<char> = all_letters.chars().collect();
    let result =
        word_box::validate_and_score(&letters, Some(&sub.words), word_box::SubmissionStatus::Won);
    match result {
        word_box::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        word_box::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                word_box::SubmissionStatus::Won => SubmissionStatus::Won,
                word_box::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// quad-words (Quordle): solution {words: string[4]};
// submission {guessHistory: string[], solvedBoards: boolean[]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuadWordsSubmission {
    #[serde(default)]
    guess_history: Option<Vec<String>>,
    #[serde(default)]
    solved_boards: Option<Vec<bool>>,
}

fn quad_words(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::quad_words;
    let Ok(sub) = serde_json::from_value::<QuadWordsSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Invalid quad-words submission");
    };
    let Some(words) = solution.get("words").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing quad-words solution words");
    };
    let targets: Vec<String> = words
        .iter()
        .filter_map(Value::as_str)
        .map(ToString::to_string)
        .collect();
    if targets.len() != 4 {
        return SubmissionVerdict::invalid("Invalid quad-words solution");
    }
    // Server-side replay: derive solved boards from the guess history alone.
    let Some(history) = sub.guess_history.as_ref() else {
        return SubmissionVerdict::invalid("Missing guess history data");
    };
    let mut solved = [false; 4];
    for guess in history {
        for (i, target) in targets.iter().enumerate() {
            if !solved[i] && quad_words::guess_solves_target(guess, target) {
                solved[i] = true;
            }
        }
    }
    let solved_count = solved.iter().filter(|s| **s).count() as u32;
    if let Some(client_claimed) = sub.solved_boards.as_ref() {
        let claimed_count = client_claimed.iter().filter(|b| **b).count() as u32;
        if claimed_count != solved_count {
            return SubmissionVerdict::invalid("Solved-board claim does not match guess history");
        }
    }
    let result = quad_words::validate_and_score(
        Some(solved_count),
        Some(history.len() as u32),
        quad_words::SubmissionStatus::Won,
    );
    match result {
        quad_words::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        quad_words::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                quad_words::SubmissionStatus::Won => SubmissionStatus::Won,
                quad_words::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// killer-sudoku: solution {grid}; submission {finalGrid, mistakes}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KillerSudokuSubmission {
    final_grid: Vec<Vec<Option<u8>>>,
    #[serde(default)]
    mistakes: Option<u32>,
}

fn killer_sudoku(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::killer_sudoku;
    let Ok(sub) = serde_json::from_value::<KillerSudokuSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing final grid data");
    };
    let Some(grid) = solution.get("grid").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing killer-sudoku solution grid");
    };
    let mut solution_grid: Vec<Vec<u8>> = Vec::new();
    for row in grid {
        let row: Vec<u8> = row
            .as_array()
            .map(|cells| {
                cells
                    .iter()
                    .filter_map(Value::as_u64)
                    .map(|v| v as u8)
                    .collect()
            })
            .unwrap_or_default();
        solution_grid.push(row);
    }
    let result = killer_sudoku::validate_and_score(
        &solution_grid,
        Some(&sub.final_grid),
        sub.mistakes.unwrap_or(0),
        env.time_spent_ms,
        killer_sudoku::SubmissionStatus::Won,
    );
    match result {
        killer_sudoku::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        killer_sudoku::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                killer_sudoku::SubmissionStatus::Won => SubmissionStatus::Won,
                killer_sudoku::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// cryptogram: solution {reverseCipher}; submission {guesses: Record<string,string>, hintsUsed}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CryptogramSubmission {
    guesses: std::collections::BTreeMap<String, String>,
    #[serde(default)]
    hints_used: Option<u32>,
}

fn cryptogram(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::cryptogram;
    let Ok(sub) = serde_json::from_value::<CryptogramSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing guesses data");
    };
    let Some(reverse_cipher) = solution.get("reverseCipher").and_then(Value::as_object) else {
        return SubmissionVerdict::invalid("Missing reverseCipher solution");
    };
    let mut cipher: std::collections::BTreeMap<String, String> = std::collections::BTreeMap::new();
    for (k, v) in reverse_cipher {
        if let Some(v) = v.as_str() {
            cipher.insert(k.clone(), v.to_string());
        }
    }
    let result = cryptogram::validate_and_score(
        &cipher,
        Some(&sub.guesses),
        sub.hints_used,
        env.time_spent_ms,
        cryptogram::SubmissionStatus::Won,
    );
    match result {
        cryptogram::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        cryptogram::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                cryptogram::SubmissionStatus::Won => SubmissionStatus::Won,
                cryptogram::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

// ---------------------------------------------------------------------------
// word-search: solution {words}; submission {foundWords: string[]}
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WordSearchSubmission {
    found_words: Vec<String>,
}

fn word_search(
    _puzzle_data: &Value,
    solution: &Value,
    env: &SubmissionEnvelope,
) -> SubmissionVerdict {
    use crate::capabilities::puzzle_play::domain::word_search;
    let Ok(sub) = serde_json::from_value::<WordSearchSubmission>(env.data.clone()) else {
        return SubmissionVerdict::invalid("Missing found words data");
    };
    let Some(words) = solution.get("words").and_then(Value::as_array) else {
        return SubmissionVerdict::invalid("Missing word-search solution words");
    };
    let solution_words: Vec<String> = words
        .iter()
        .filter_map(Value::as_str)
        .map(ToString::to_string)
        .collect();
    let found: Vec<String> = sub
        .found_words
        .iter()
        .map(|w| w.to_ascii_uppercase())
        .collect();
    let result = word_search::validate_and_score(
        &solution_words,
        Some(&found),
        env.time_spent_ms,
        word_search::SubmissionStatus::Won,
    );
    match result {
        word_search::GameResult::Invalid { error } => SubmissionVerdict::invalid(error),
        word_search::GameResult::Valid { status, score } => SubmissionVerdict::valid(
            match status {
                word_search::SubmissionStatus::Won => SubmissionStatus::Won,
                word_search::SubmissionStatus::Lost => SubmissionStatus::Lost,
            },
            score,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn env(data: Value) -> SubmissionEnvelope {
        SubmissionEnvelope {
            status: SubmissionStatus::Won,
            attempts: 1,
            time_spent_ms: 1000,
            data,
        }
    }

    #[test]
    fn sudoku_accepts_correct_grid() {
        let solution = json!({ "grid": [[1,2],[3,4]] });
        let data = env(json!({ "finalGrid": [[1,2],[3,4]] }));
        // 2x2 is not a valid sudoku size; expect a validation error, not a panic.
        let v = validate_submission("sudoku", &json!({}), &solution, &data);
        assert!(!v.valid);
    }

    #[test]
    fn word_guess_validates_guesses() {
        let solution = json!({ "word": "HELLO" });
        let data = env(json!({ "guesses": ["HELLO"] }));
        let v = validate_submission("word-guess", &json!({}), &solution, &data);
        assert!(v.valid, "expected valid: {v:?}");
        assert_eq!(v.score, Some(100));
    }

    #[test]
    fn word_guess_rejects_missing_guesses() {
        let solution = json!({ "word": "HELLO" });
        let v = validate_submission("word-guess", &json!({}), &solution, &env(json!({})));
        assert!(!v.valid);
    }

    #[test]
    fn block_slide_uses_server_min_moves() {
        let solution = json!({ "minMoves": 5 });
        let data = env(json!({ "moveCount": 5, "minMoves": 1 })); // client minMoves ignored
        let v = validate_submission("block-slide", &json!({}), &solution, &data);
        assert!(v.valid, "expected valid: {v:?}");
    }

    #[test]
    fn tango_accepts_full_solution() {
        let solution = json!({ "grid": [["sun","moon"],["moon","sun"]] });
        let data = env(json!({ "grid": [["sun","moon"],["moon","sun"]] }));
        let v = validate_submission("tango", &json!({}), &solution, &data);
        assert!(v.valid, "expected valid: {v:?}");
    }

    #[test]
    fn quad_words_rejects_false_solved_claim() {
        let solution = json!({ "words": ["ABCD", "EFGH", "IJKL", "MNOP"] });
        // guesses that never solve any board; client claims 4 solved
        let data = env(
            json!({ "guessHistory": ["AAAA", "BBBB"], "solvedBoards": [true, true, true, true] }),
        );
        let v = validate_submission("quad-words", &json!({}), &solution, &data);
        assert!(!v.valid);
    }

    #[test]
    fn unknown_game_fails_closed() {
        let v = validate_submission("no-such-game", &json!({}), &json!({}), &env(json!({})));
        assert!(!v.valid);
    }
}
