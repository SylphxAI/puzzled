//! Seed-based puzzle grid generation HTTP handler (ADR-168 S2).

use axum::extract::Query;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use puzzled_core::{generate_sudoku_puzzle, SudokuDifficulty, SudokuPuzzleResult};
use serde::Deserialize;
use serde_json::json;

#[derive(Debug, Deserialize)]
pub struct GenerateGridQuery {
    #[serde(rename = "gameSlug")]
    pub game_slug: String,
    pub seed: i64,
    pub difficulty: Option<String>,
}

fn parse_difficulty(raw: Option<&str>) -> SudokuDifficulty {
    match raw.unwrap_or("medium").to_ascii_lowercase().as_str() {
        "easy" => SudokuDifficulty::Easy,
        "hard" => SudokuDifficulty::Hard,
        _ => SudokuDifficulty::Medium,
    }
}

pub async fn generate_grid(Query(query): Query<GenerateGridQuery>) -> Response {
    if query.game_slug != "sudoku" {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "unsupported gameSlug",
                "supported": ["sudoku"],
                "slice": "S2-puzzle-grid",
            })),
        )
            .into_response();
    }

    let difficulty = parse_difficulty(query.difficulty.as_deref());
    let result: SudokuPuzzleResult = generate_sudoku_puzzle(query.seed, difficulty);

    (
        StatusCode::OK,
        Json(json!({
            "gameSlug": query.game_slug,
            "seed": query.seed,
            "puzzleData": result.puzzle_data,
            "solution": result.solution,
            "slice": "S2-puzzle-grid",
        })),
    )
        .into_response()
}
