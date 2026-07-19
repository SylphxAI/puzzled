//! Golden fixture parity: Rust puzzle solution scoring vs TS baseline corpus.

use std::fs;
use std::path::PathBuf;

use puzzled_core::{
    generate_sudoku_puzzle, validate_and_score_sudoku, GameSubmission, ScoringResult,
    SubmissionStatus, SudokuDifficulty,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
struct GoldenFile {
    #[serde(rename = "scoringCases")]
    scoring_cases: Vec<ScoringCase>,
}

#[derive(Debug, Deserialize)]
struct ScoringCase {
    id: String,
    #[serde(rename = "gameSlug")]
    game_slug: String,
    seed: i64,
    difficulty: String,
    submission: SubmissionTemplate,
    expected: Value,
}

#[derive(Debug, Deserialize)]
struct SubmissionTemplate {
    status: SubmissionStatus,
    attempts: u32,
    #[serde(rename = "timeSpentMs")]
    time_spent_ms: u64,
    data: SubmissionDataTemplate,
}

#[derive(Debug, Deserialize)]
struct SubmissionDataTemplate {
    #[serde(rename = "useSolutionGrid")]
    use_solution_grid: Option<bool>,
    #[serde(rename = "useIncorrectGrid")]
    use_incorrect_grid: Option<bool>,
    mistakes: Option<u64>,
    #[serde(rename = "finalGrid")]
    final_grid: Option<Value>,
}

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/puzzle-solution/golden.json")
}

fn load_golden() -> GoldenFile {
    let path = golden_path();
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read golden corpus {}: {error}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("parse golden corpus {}: {error}", path.display()))
}

fn parse_difficulty(raw: &str) -> SudokuDifficulty {
    match raw.to_ascii_lowercase().as_str() {
        "easy" => SudokuDifficulty::Easy,
        "hard" => SudokuDifficulty::Hard,
        _ => SudokuDifficulty::Medium,
    }
}

fn grid_to_json(grid: &[Vec<u8>]) -> Value {
    Value::Array(
        grid.iter()
            .map(|row| {
                Value::Array(
                    row.iter()
                        .map(|cell| Value::Number((*cell).into()))
                        .collect(),
                )
            })
            .collect(),
    )
}

fn incorrect_grid(grid: &[Vec<u8>]) -> Value {
    let mut copy = grid.to_vec();
    copy[0][0] = (copy[0][0] % 9) + 1;
    grid_to_json(&copy)
}

fn build_submission(template: &SubmissionTemplate, solution_grid: &[Vec<u8>]) -> GameSubmission {
    let data = if let Some(final_grid) = &template.data.final_grid {
        json!({
            "finalGrid": final_grid,
            "mistakes": template.data.mistakes.unwrap_or(0)
        })
    } else if template.data.use_solution_grid == Some(true) {
        json!({
            "finalGrid": grid_to_json(solution_grid),
            "mistakes": template.data.mistakes.unwrap_or(0)
        })
    } else if template.data.use_incorrect_grid == Some(true) {
        json!({
            "finalGrid": incorrect_grid(solution_grid),
            "mistakes": template.data.mistakes.unwrap_or(0)
        })
    } else {
        json!({
            "mistakes": template.data.mistakes.unwrap_or(0)
        })
    };

    GameSubmission {
        status: template.status,
        attempts: template.attempts,
        time_spent_ms: template.time_spent_ms,
        data: Some(data),
    }
}

fn scoring_to_json(result: &ScoringResult) -> Value {
    match result {
        ScoringResult::Valid { status, score, .. } => json!({
            "valid": true,
            "status": status,
            "score": score
        }),
        ScoringResult::Invalid { error, .. } => json!({
            "valid": false,
            "error": error
        }),
    }
}

#[test]
fn scoring_cases_match_golden_baseline() {
    let golden = load_golden();
    for case in &golden.scoring_cases {
        assert_eq!(case.game_slug, "sudoku", "case {}", case.id);
        let difficulty = parse_difficulty(&case.difficulty);
        let puzzle = generate_sudoku_puzzle(case.seed, difficulty);
        let submission = build_submission(&case.submission, &puzzle.solution.grid);
        let actual = validate_and_score_sudoku(&puzzle.solution, &submission);
        let actual_json = scoring_to_json(&actual);
        assert_eq!(actual_json, case.expected, "case {}", case.id);
    }
}
