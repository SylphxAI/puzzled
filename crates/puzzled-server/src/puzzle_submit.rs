//! Puzzle solution submit + scoring HTTP handler (ADR-168 S2).

use axum::extract::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use puzzled_core::{
    validate_and_score_sudoku, GameSubmission, ScoringResult, SudokuSolution,
};
use serde::Deserialize;
use serde_json::{json, Value};

const SLICE: &str = "S2-puzzle-solution-submit";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitSolutionBody {
    pub game_slug: String,
    pub solution: SudokuSolution,
    #[serde(default)]
    pub puzzle_data: Option<Value>,
    pub submission: GameSubmission,
}

fn scoring_response(result: ScoringResult) -> Value {
    match result {
        ScoringResult::Valid { status, score, .. } => {
            json!({
                "valid": true,
                "status": status,
                "score": score,
                "slice": SLICE,
            })
        }
        ScoringResult::Invalid { error, .. } => json!({
            "valid": false,
            "error": error,
            "slice": SLICE,
        }),
    }
}

pub async fn submit_solution(Json(body): Json<SubmitSolutionBody>) -> Response {
    if body.game_slug != "sudoku" {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "unsupported gameSlug",
                "supported": ["sudoku"],
                "slice": SLICE,
            })),
        )
            .into_response();
    }

    let _ = body.puzzle_data;
    let result = validate_and_score_sudoku(&body.solution, &body.submission);
    (StatusCode::OK, Json(scoring_response(result))).into_response()
}