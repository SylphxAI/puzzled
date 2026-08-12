//! Native Connect PuzzleService — server-authoritative play (ADR-170).
//!
//! - Solutions never leave the server.
//! - GetDaily serves the stored/generated puzzle data only; completion is
//!   derived from the user's sessions, never from a client flag.
//! - SubmitGuess resolves the served puzzle itself (puzzle_id or puzzle_date),
//!   validates the final submission against the server's solution via the
//!   pure dispatch, and persists the verified result. Client seeds/verdicts
//!   are never trusted.

use std::sync::Arc;

use chrono::{NaiveDate, Utc};
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use serde_json::Value;
use tracing::warn;

use puzzled_core::puzzle_play::application::submission_validation::{
    validate_submission, SubmissionEnvelope,
};
use puzzled_core::puzzle_play::daily_time::{get_puzzle_number, product_day_key};
use puzzled_core::puzzle_play::domain::scoring::SubmissionStatus;
use puzzled_core::puzzle_play::game_flows::build_daily_status;
use puzzled_core::puzzle_play::game_slugs::{is_game_free_today, is_valid_game_slug};
use puzzled_core::{generate_sudoku_puzzle, SudokuDifficulty};

use super::state::AppState;
use crate::capabilities::puzzle_play::adapters::daily_puzzles_db::{
    fetch_daily_puzzle, fetch_puzzle_by_id,
};
use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    has_completed_session, persist_validated_session,
};
use crate::proto::puzzled::v1::{
    GetDailyRequest, GetDailyResponse, GetPuzzleRequest, GetPuzzleResponse, PuzzleService,
    SubmitGuessRequest, SubmitGuessResponse,
};
use crate::shared::platform_billing::is_premium;

const SLICE_PUZZLE: &str = "S2-puzzle-connect";
const SLICE_DAILY: &str = "S2-daily-connect";
const SLICE_SUBMIT: &str = "S2-puzzle-solution-connect";

#[derive(Clone)]
pub struct PuzzleConnectService {
    state: AppState,
}

impl PuzzleConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    fn identity(&self, ctx: &RequestContext) -> Result<Option<String>, ConnectError> {
        use crate::bootstrap::identity::require_identity;
        match require_identity(ctx) {
            Ok(identity) => Ok(Some(identity.user_id)),
            Err(_) => Ok(None), // guest read; submits enforce identity separately
        }
    }

    /// Enforce premium gating for a served puzzle (ADR-170).
    ///
    /// - Archive reads (date != today) always require premium.
    /// - Non-rotation games require premium.
    /// - The daily free-rotation game is playable by everyone.
    async fn enforce_play_access(
        &self,
        user_id: Option<&str>,
        game_slug: &str,
        date: chrono::NaiveDate,
    ) -> Result<(), ConnectError> {
        // Product day-key SSOT (Asia/Hong_Kong) — not client local, not legacy UTC.
        let today = product_day_key(Utc::now());
        if date != today {
            // Archive access is a premium feature.
            return self.require_premium(user_id).await;
        }
        if !is_game_free_today(game_slug, today) {
            return self.require_premium(user_id).await;
        }
        Ok(())
    }

    async fn require_premium(&self, user_id: Option<&str>) -> Result<(), ConnectError> {
        let Some(uid) = user_id else {
            return Err(ConnectError::new(
                ErrorCode::PermissionDenied,
                "premium_required",
            ));
        };
        if is_premium(uid).await {
            Ok(())
        } else {
            Err(ConnectError::new(
                ErrorCode::PermissionDenied,
                "premium_required",
            ))
        }
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

fn parse_status(raw: &str) -> Option<SubmissionStatus> {
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

/// Deterministic sudoku fallback when no stored row exists (S0 / no DB).
fn sudoku_puzzle_data(seed: i64, difficulty: SudokuDifficulty) -> Value {
    let generated = generate_sudoku_puzzle(seed, difficulty);
    serde_json::to_value(&generated.puzzle_data).unwrap_or(Value::Null)
}

fn sudoku_solution(seed: i64, difficulty: SudokuDifficulty) -> Value {
    let generated = generate_sudoku_puzzle(seed, difficulty);
    serde_json::to_value(&generated.solution).unwrap_or(Value::Null)
}

fn date_from_string(raw: Option<&str>) -> Option<NaiveDate> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    NaiveDate::parse_from_str(raw, "%Y-%m-%d").ok()
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
        let puzzle_data = sudoku_puzzle_data(req.seed, difficulty);

        Response::ok(GetPuzzleResponse {
            game_slug: game_slug.to_string(),
            seed: req.seed,
            difficulty: difficulty_label(difficulty).to_string(),
            puzzle_data_json: puzzle_data.to_string(),
            slice: SLICE_PUZZLE.to_string(),
            ..Default::default()
        })
    }

    async fn get_daily(
        &self,
        ctx: RequestContext,
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

        let identity = self.identity(&ctx)?;
        let difficulty = {
            let d = req.difficulty.trim();
            if d.is_empty() {
                None
            } else {
                Some(d.to_string())
            }
        };
        let today = product_day_key(Utc::now());
        // Archive reads: puzzle_date (YYYY-MM-DD), default = product day key.
        let puzzle_date = date_from_string(req.puzzle_date.as_deref()).unwrap_or(today);
        let is_archive = puzzle_date != today;

        // Server-enforced premium gating (archive + non-rotation games).
        self.enforce_play_access(identity.as_deref(), game_slug, puzzle_date)
            .await?;

        // Resolve the served puzzle: stored row first, deterministic sudoku fallback.
        let mut puzzle_data: Option<Value> = None;
        let mut puzzle_id: Option<String> = None;
        let mut stub = true;
        if let Some(pool) = &self.state.pool {
            match fetch_daily_puzzle(pool, game_slug, puzzle_date, difficulty.as_deref()).await {
                Ok(Some(p)) => {
                    puzzle_data = Some(p.puzzle_data);
                    puzzle_id = Some(p.id.to_string());
                    stub = false;
                }
                Ok(None) => {}
                Err(error) => warn!(%error, "get_daily puzzle lookup failed"),
            }
        }
        if puzzle_data.is_none() && game_slug == "sudoku" {
            let seed = i64::from(get_puzzle_number(puzzle_date, None));
            let diff = parse_difficulty(difficulty.as_deref().unwrap_or("medium"));
            puzzle_data = Some(sudoku_puzzle_data(seed, diff));
            stub = false;
        }

        // Completion is server-derived from the user's sessions.
        let has_completed = match (identity.as_deref(), &self.state.pool) {
            (Some(uid), Some(pool)) => {
                match has_completed_session(
                    pool,
                    uid,
                    game_slug,
                    Some(puzzle_date),
                    puzzle_id.as_deref(),
                )
                .await
                {
                    Ok(v) => v,
                    Err(error) => {
                        warn!(%error, "get_daily completion lookup failed");
                        false
                    }
                }
            }
            _ => false,
        };

        let puzzle_data_value = puzzle_data.clone();
        match build_daily_status(
            game_slug,
            today,
            difficulty.as_deref(),
            if has_completed {
                Some(Value::Null)
            } else {
                None
            },
            puzzle_id.clone(),
            puzzle_data_value,
        ) {
            Ok(body) => Response::ok(GetDailyResponse {
                game_slug: game_slug.to_string(),
                puzzle_number: body.puzzle.puzzle_number,
                puzzle_date: if is_archive {
                    puzzle_date.format("%Y-%m-%d").to_string()
                } else {
                    body.puzzle.puzzle_date
                },
                puzzle_id,
                difficulty: body
                    .puzzle
                    .difficulty
                    .unwrap_or_else(|| difficulty.unwrap_or_default()),
                has_completed,
                can_play: !has_completed,
                mode: body.mode.to_string(),
                slice: SLICE_DAILY.to_string(),
                stub,
                puzzle_data_json: puzzle_data.map(|v| v.to_string()).unwrap_or_default(),
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
        ctx: RequestContext,
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
        if !is_valid_game_slug(game_slug) {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "unknown_game",
            ));
        }
        let Some(status) = parse_status(&req.status) else {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "status_required_won_or_lost",
            ));
        };
        let Some(uid) = self.identity(&ctx)? else {
            return Err(ConnectError::new(
                ErrorCode::Unauthenticated,
                "identity_required_for_submit",
            ));
        };

        let data: Value = if req.submission_json.trim().is_empty() {
            Value::Null
        } else {
            match serde_json::from_str(&req.submission_json) {
                Ok(v) => v,
                Err(_) => {
                    return Err(ConnectError::new(
                        ErrorCode::InvalidArgument,
                        "invalid_submission_json",
                    ));
                }
            }
        };

        let now = Utc::now();
        let today = product_day_key(now);
        let date = date_from_string(req.puzzle_date.as_deref()).unwrap_or(today);
        // Server-enforced premium gating (archive + non-rotation games).
        self.enforce_play_access(Some(&uid), game_slug, date)
            .await?;
        let difficulty = {
            let d = req.difficulty.trim();
            if d.is_empty() {
                None
            } else {
                Some(d.to_string())
            }
        };

        // Resolve the served puzzle: stored row by id, else by date, else
        // deterministic sudoku. The client's seed is never an authority input.
        let (puzzle_data, solution, resolved_id) = if let Some(pid) = req.puzzle_id.as_deref() {
            match &self.state.pool {
                Some(pool) => match fetch_puzzle_by_id(pool, pid).await {
                    Ok(Some(p)) if p.game_slug == game_slug => {
                        (p.puzzle_data, p.solution, Some(p.id.to_string()))
                    }
                    Ok(Some(_)) => {
                        return Err(ConnectError::new(
                            ErrorCode::InvalidArgument,
                            "puzzle_game_slug_mismatch",
                        ));
                    }
                    Ok(None) => {
                        return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
                    }
                    Err(error) => {
                        warn!(%error, "submit puzzle lookup failed");
                        return Err(ConnectError::new(
                            ErrorCode::Internal,
                            "puzzle_lookup_failed",
                        ));
                    }
                },
                None => {
                    return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
                }
            }
        } else if let Some(pool) = &self.state.pool {
            match fetch_daily_puzzle(pool, game_slug, date, difficulty.as_deref()).await {
                Ok(Some(p)) => (p.puzzle_data, p.solution, Some(p.id.to_string())),
                Ok(None) => {
                    if game_slug == "sudoku" {
                        let seed = i64::from(get_puzzle_number(date, None));
                        let diff = parse_difficulty(difficulty.as_deref().unwrap_or("medium"));
                        (
                            sudoku_puzzle_data(seed, diff),
                            Some(sudoku_solution(seed, diff)),
                            None,
                        )
                    } else {
                        return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
                    }
                }
                Err(error) => {
                    warn!(%error, "submit puzzle lookup failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "puzzle_lookup_failed",
                    ));
                }
            }
        } else if game_slug == "sudoku" {
            let seed = i64::from(get_puzzle_number(date, None));
            let diff = parse_difficulty(difficulty.as_deref().unwrap_or("medium"));
            (
                sudoku_puzzle_data(seed, diff),
                Some(sudoku_solution(seed, diff)),
                None,
            )
        } else {
            return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
        };

        let Some(solution) = solution else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "puzzle_solution_unavailable",
            ));
        };

        // One verified result per served puzzle.
        if let (Some(pool), Some(pid)) = (&self.state.pool, resolved_id.as_deref()) {
            match has_completed_session(pool, &uid, game_slug, None, Some(pid)).await {
                Ok(true) => {
                    return Err(ConnectError::new(
                        ErrorCode::AlreadyExists,
                        "already_played",
                    ));
                }
                Ok(false) => {}
                Err(error) => {
                    warn!(%error, "submit completion lookup failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "session_lookup_failed",
                    ));
                }
            }
        }

        let envelope = SubmissionEnvelope {
            status,
            attempts: req.attempts,
            time_spent_ms: req.time_spent_ms,
            data,
        };
        let verdict = validate_submission(game_slug, &puzzle_data, &solution, &envelope);

        if !verdict.valid {
            return Response::ok(SubmitGuessResponse {
                valid: false,
                status: String::new(),
                score: None,
                game_slug: game_slug.to_string(),
                error: verdict
                    .error
                    .clone()
                    .or_else(|| Some("invalid_submission".to_string())),
                slice: SLICE_SUBMIT.to_string(),
                ..Default::default()
            });
        }

        let score = verdict.score.unwrap_or(0);
        let mode = if date == today { "daily" } else { "archive" };
        // Ritual day_key: for daily mode use product day key; archive is not ritual.
        let ritual_day_key = if mode == "daily" { Some(today) } else { None };
        if let Some(pool) = &self.state.pool {
            match persist_validated_session(
                pool,
                &uid,
                game_slug,
                difficulty.as_deref(),
                mode,
                status_label(verdict.status.unwrap_or(status)),
                Some(i32::try_from(score).unwrap_or(i32::MAX)),
                req.attempts,
                req.time_spent_ms,
                resolved_id.as_deref(),
                Some(date),
                ritual_day_key,
                now.timestamp_millis(),
            )
            .await
            {
                Ok(_) => {}
                Err(error) => {
                    warn!(%error, "submit session persist failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "session_persist_failed",
                    ));
                }
            }
        }

        Response::ok(SubmitGuessResponse {
            valid: true,
            status: status_label(verdict.status.unwrap_or(status)).to_string(),
            score: Some(score),
            game_slug: game_slug.to_string(),
            error: None,
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        })
    }
}

pub fn puzzle_connect_service(state: AppState) -> Arc<PuzzleConnectService> {
    Arc::new(PuzzleConnectService::new(state))
}
