//! Native Connect PuzzleService — technology-stack-profile (buffa + connectrpc).
//! Primary product play densify: GetPuzzle / GetDaily / SubmitGuess (not pure residual).

use std::sync::Arc;

use chrono::Utc;
use connectrpc::{ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult};
use puzzled_core::puzzle_play::daily_time::{get_puzzle_number, get_today_utc};
use puzzled_core::puzzle_play::game_flows::build_daily_status;
use puzzled_core::puzzle_play::game_slugs::is_valid_game_slug;
use puzzled_core::{
    generate_sudoku_puzzle, validate_and_score_sudoku, GameSubmission, ScoringResult,
    SudokuDifficulty, SubmissionStatus,
};
use serde_json::{json, Value};

use super::state::AppState;
use crate::proto::puzzled::v1::{
    GetDailyRequest, GetDailyResponse, GetPuzzleRequest, GetPuzzleResponse, PuzzleService,
    SubmitGuessRequest, SubmitGuessResponse,
};

const SLICE_PUZZLE: &str = "S2-puzzle-connect";
const SLICE_DAILY: &str = "S2-daily-connect";
const SLICE_SUBMIT: &str = "S2-puzzle-solution-connect";

#[derive(Clone)]
pub struct PuzzleConnectService {
    #[allow(dead_code)]
    state: AppState,
}

impl PuzzleConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

fn parse_difficulty(raw: &str) -> SudokuDifficulty {
    match raw.trim().to_ascii_lowercase().as_str() {
        "easy" => SudokuDifficulty::Easy,
        "hard" => SudokuDifficulty::Hard,
        _ => SudokuDifficulty::Medium,
    }
}

fn difficulty_label(d: SudokuDifficulty) -> &'static str {
    match d {
        SudokuDifficulty::Easy => "easy",
        SudokuDifficulty::Medium => "medium",
        SudokuDifficulty::Hard => "hard",
    }
}

fn parse_submission_status(raw: &str) -> Option<SubmissionStatus> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "won" => Some(SubmissionStatus::Won),
        "lost" => Some(SubmissionStatus::Lost),
        _ => None,
    }
}

fn status_label(s: SubmissionStatus) -> &'static str {
    match s {
        SubmissionStatus::Won => "won",
        SubmissionStatus::Lost => "lost",
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl PuzzleService for PuzzleConnectService {
    async fn get_puzzle(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, GetPuzzleRequest>,
    ) -> ServiceResult<GetPuzzleResponse> {
        let req = request.to_owned_message();
        let game_slug = req.game_slug.trim();
        if game_slug.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "game_slug_required",
            ));
        }
        if game_slug != "sudoku" {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "unsupported_game_slug",
            ));
        }

        let difficulty = parse_difficulty(&req.difficulty);
        let result = generate_sudoku_puzzle(req.seed, difficulty);

        let puzzle_data_json = serde_json::to_string(&result.puzzle_data).unwrap_or_else(|_| {
            json!({
                "grid": result.puzzle_data.grid,
                "difficulty": result.puzzle_data.difficulty,
            })
            .to_string()
        });
        let solution_json = serde_json::to_string(&result.solution).unwrap_or_else(|_| {
            json!({ "grid": result.solution.grid }).to_string()
        });

        Response::ok(GetPuzzleResponse {
            game_slug: game_slug.to_string(),
            seed: req.seed,
            difficulty: difficulty_label(difficulty).to_string(),
            puzzle_data_json,
            solution_json,
            slice: SLICE_PUZZLE.to_string(),
            ..Default::default()
        })
    }

    async fn get_daily(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, GetDailyRequest>,
    ) -> ServiceResult<GetDailyResponse> {
        let req = request.to_owned_message();
        let game_slug = req.game_slug.trim();
        if game_slug.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "game_slug_required",
            ));
        }
        if !is_valid_game_slug(game_slug) {
            return Err(ConnectError::new(ErrorCode::NotFound, "unknown_game"));
        }

        let difficulty = {
            let d = req.difficulty.trim();
            if d.is_empty() {
                None
            } else {
                Some(d)
            }
        };
        let today = get_today_utc(Utc::now());
        let completed = if req.has_completed {
            Some(json!({ "status": "won", "stub": true }))
        } else {
            None
        };
        let puzzle_id = req
            .puzzle_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);

        // Real densify: pure daily envelope + optional seed-grid for sudoku.
        let (puzzle_data_json, stub) = if game_slug == "sudoku" {
            let seed = i64::from(get_puzzle_number(today, None));
            let diff = parse_difficulty(difficulty.unwrap_or("medium"));
            let generated = generate_sudoku_puzzle(seed, diff);
            let json_s = serde_json::to_string(&generated.puzzle_data).unwrap_or_default();
            (json_s, false)
        } else {
            (String::new(), puzzle_id.is_none())
        };

        let puzzle_data_value: Option<Value> = if puzzle_data_json.is_empty() {
            None
        } else {
            serde_json::from_str(&puzzle_data_json).ok()
        };

        match build_daily_status(
            game_slug,
            today,
            difficulty,
            completed,
            puzzle_id.clone(),
            puzzle_data_value,
        ) {
            Ok(body) => Response::ok(GetDailyResponse {
                game_slug: game_slug.to_string(),
                puzzle_number: body.puzzle.puzzle_number,
                puzzle_date: body.puzzle.puzzle_date,
                puzzle_id: body.puzzle.id,
                difficulty: body
                    .puzzle
                    .difficulty
                    .unwrap_or_else(|| difficulty.unwrap_or("").to_string()),
                has_completed: body.has_completed,
                can_play: body.can_play,
                mode: body.mode.to_string(),
                slice: SLICE_DAILY.to_string(),
                stub,
                puzzle_data_json,
                ..Default::default()
            }),
            Err(404) => Err(ConnectError::new(ErrorCode::NotFound, "unknown_game")),
            Err(_) => Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "invalid_query",
            )),
        }
    }

    async fn submit_guess(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, SubmitGuessRequest>,
    ) -> ServiceResult<SubmitGuessResponse> {
        let req = request.to_owned_message();
        let game_slug = req.game_slug.trim();
        if game_slug.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "game_slug_required",
            ));
        }
        if game_slug != "sudoku" {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "unsupported_game_slug",
            ));
        }

        let Some(status) = parse_submission_status(&req.status) else {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "status_required_won_or_lost",
            ));
        };

        let data: Option<Value> = if req.submission_json.trim().is_empty() {
            None
        } else {
            match serde_json::from_str(&req.submission_json) {
                Ok(v) => Some(v),
                Err(_) => {
                    return Err(ConnectError::new(
                        ErrorCode::InvalidArgument,
                        "invalid_submission_json",
                    ));
                }
            }
        };

        let difficulty = parse_difficulty(&req.difficulty);
        let puzzle = generate_sudoku_puzzle(req.seed, difficulty);
        let submission = GameSubmission {
            status,
            attempts: req.attempts,
            time_spent_ms: req.time_spent_ms,
            data,
        };
        let result = validate_and_score_sudoku(&puzzle.solution, &submission);

        match result {
            ScoringResult::Valid {
                valid,
                status,
                score,
            } => Response::ok(SubmitGuessResponse {
                valid,
                status: status_label(status).to_string(),
                score: Some(score),
                game_slug: game_slug.to_string(),
                seed: req.seed,
                error: None,
                slice: SLICE_SUBMIT.to_string(),
                ..Default::default()
            }),
            ScoringResult::Invalid { valid, error } => Response::ok(SubmitGuessResponse {
                valid,
                status: String::new(),
                score: None,
                game_slug: game_slug.to_string(),
                seed: req.seed,
                error: Some(error),
                slice: SLICE_SUBMIT.to_string(),
                ..Default::default()
            }),
        }
    }
}

pub fn puzzle_connect_service(state: AppState) -> Arc<PuzzleConnectService> {
    Arc::new(PuzzleConnectService::new(state))
}
