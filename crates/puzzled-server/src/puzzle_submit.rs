//! Puzzle solution submit HTTP handler (ADR-168 S2).

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use puzzled_core::{
    generate_sudoku_puzzle, validate_and_score_sudoku, GameSubmission, ScoringResult,
    SudokuDifficulty,
};
use serde::Deserialize;
use serde_json::json;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitBody {
    pub game_slug: String,
    pub seed: i64,
    pub difficulty: Option<String>,
    pub submission: GameSubmission,
}

fn parse_difficulty(raw: Option<&str>) -> SudokuDifficulty {
    match raw.unwrap_or("medium").to_ascii_lowercase().as_str() {
        "easy" => SudokuDifficulty::Easy,
        "hard" => SudokuDifficulty::Hard,
        _ => SudokuDifficulty::Medium,
    }
}

pub async fn submit_solution(Json(body): Json<SubmitBody>) -> Response {
    if body.game_slug != "sudoku" {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "unsupported gameSlug",
                "supported": ["sudoku"],
                "slice": "S2-puzzle-solution",
            })),
        )
            .into_response();
    }

    let difficulty = parse_difficulty(body.difficulty.as_deref());
    let puzzle = generate_sudoku_puzzle(body.seed, difficulty);
    let result = validate_and_score_sudoku(&puzzle.solution, &body.submission);

    match result {
        ScoringResult::Valid {
            valid,
            status,
            score,
        } => (
            StatusCode::OK,
            Json(json!({
                "valid": valid,
                "status": status,
                "score": score,
                "gameSlug": body.game_slug,
                "seed": body.seed,
                "slice": "S2-puzzle-solution",
            })),
        )
            .into_response(),
        ScoringResult::Invalid { valid, error } => (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "valid": valid,
                "error": error,
                "gameSlug": body.game_slug,
                "seed": body.seed,
                "slice": "S2-puzzle-solution",
            })),
        )
            .into_response(),
    }
}
