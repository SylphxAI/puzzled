//! Native Connect PuzzleService — server-authoritative play (ADR-170).
//!
//! - Solutions never leave the server.
//! - GetDaily serves the stored/generated puzzle data only; completion is
//!   derived from the user's sessions, never from a client flag.
//! - SubmitGuess resolves the served puzzle itself (puzzle_id or puzzle_date),
//!   validates the final submission against the server's solution via the
//!   pure dispatch, and persists the verified result. Client seeds/verdicts
//!   are never trusted.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{NaiveDate, Utc};
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};
use serde_json::Value;
use tracing::warn;

use puzzled_core::billing_access::policy::play_access;
use puzzled_core::puzzle_play::application::guess_grading::{
    grade_guess, grades_guesses, guess_limit,
};
use puzzled_core::puzzle_play::application::submission_validation::{
    validate_submission, SubmissionEnvelope,
};
use puzzled_core::puzzle_play::crossword_generate::client_safe_puzzle_data;
use puzzled_core::puzzle_play::daily_time::product_day_key;
use puzzled_core::puzzle_play::domain::scoring::SubmissionStatus;
use puzzled_core::puzzle_play::game_flows::build_daily_status;
use puzzled_core::puzzle_play::game_slugs::{
    canonicalize_game_slug, is_game_free_today, is_valid_game_slug,
};
use puzzled_core::{generate_sudoku_puzzle, SudokuDifficulty};

use super::state::AppState;
use crate::capabilities::billing::service::access as entitlement_access;
use crate::capabilities::daily_pipeline;
use crate::capabilities::gamification::adapters::streak_read::load_settled_streak_on_connection;
use crate::capabilities::puzzle_play::adapters::daily_puzzles_db::fetch_puzzle_by_id;
use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    has_completed_session_on_connection, has_ritual_completion_on_connection,
    load_completed_session_on_connection, load_today_progress_on_connection,
    persist_validated_session_on_connection, CompletedSession,
};
use crate::capabilities::puzzle_play::adapters::result_shares_db::{
    load_shared_result, record_share_on_connection, set_share_streak_on_connection,
};
use crate::proto::puzzled::v1::{
    CheckGuessRequest, CheckGuessResponse, DailyCompletion, GameProgress, GetDailyRequest,
    GetDailyResponse, GetPuzzleRequest, GetPuzzleResponse, GetSharedResultRequest,
    GetSharedResultResponse, GetTodayProgressRequest, GetTodayProgressResponse, PuzzleService,
    ShareResultRequest, ShareResultResponse, SubmitGuessRequest, SubmitGuessResponse,
};

const SLICE_PUZZLE: &str = "S2-puzzle-connect";
const SLICE_DAILY: &str = "S2-daily-connect";
const SLICE_SUBMIT: &str = "S2-puzzle-solution-connect";

#[derive(Clone)]
pub struct PuzzleConnectService {
    state: AppState,
    /// Graded guesses per (player, game, day, difficulty), capped at the
    /// game's own guess limit so CheckGuess cannot be used to search for the
    /// answer. Per process and per day; cleared when the day changes.
    guesses: Arc<std::sync::Mutex<(NaiveDate, HashMap<String, u32>)>>,
}

impl PuzzleConnectService {
    pub fn new(state: AppState) -> Self {
        Self {
            state,
            guesses: Arc::new(std::sync::Mutex::new((NaiveDate::MIN, HashMap::new()))),
        }
    }

    /// Count one graded guess; false once the player has used the game's limit.
    fn take_guess(&self, key: String, today: NaiveDate, limit: u32) -> bool {
        let Ok(mut guard) = self.guesses.lock() else {
            return false;
        };
        if guard.0 != today {
            *guard = (today, HashMap::new());
        }
        let used = guard.1.entry(key).or_insert(0);
        if *used >= limit {
            return false;
        }
        *used += 1;
        true
    }

    /// Reassign accepted guest rows onto the Platform account before a personal
    /// read or write. Fail closed so a missed merge cannot accept a second finish.
    async fn adopt_guest_progress_if_needed(
        &self,
        ctx: &RequestContext,
        guest_write: bool,
    ) -> Result<crate::bootstrap::identity::RequestAccess, ConnectError> {
        crate::bootstrap::identity::admitted_request_identities(
            ctx,
            self.state.pool.as_ref(),
            guest_write,
        )
        .await
    }

    /// Admit a served puzzle (Puzzled Plus gate, the one admission point).
    ///
    /// A future day is refused so no one can read tomorrow's solution early.
    /// Today's featured game is free to everyone; every other game and every
    /// past day needs Puzzled Plus once it is on sale. While Money is not
    /// configured nothing is sold, so nothing is locked. An entitlement read
    /// that fails refuses (fail closed to the free floor).
    async fn enforce_play_access(
        &self,
        user_id: Option<&str>,
        game_slug: &str,
        date: NaiveDate,
    ) -> Result<(), ConnectError> {
        let today = product_day_key(Utc::now());
        if date > today {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "future_puzzle_date",
            ));
        }
        let is_today = date == today;
        let free_today = is_game_free_today(game_slug, today);
        // The free daily puzzle is decided without any billing read.
        if play_access(true, false, is_today, free_today).is_ok() {
            return Ok(());
        }
        let sales_open = self.state.sales_open().await;
        if !sales_open {
            return Ok(());
        }
        let entitled = match (user_id, &self.state.pool) {
            (Some(uid), Some(pool)) => {
                match entitlement_access(pool, self.state.money.as_ref(), uid).await {
                    Ok(found) => found.entitled,
                    Err(error) => {
                        warn!(%error, "entitlement read failed; refusing paid play");
                        false
                    }
                }
            }
            _ => false,
        };
        // ---- WORKAROUND(plus-grace-window) -------------------------------
        // CEO ruling 2026-10-02: accounts that played before Plus sales opened
        // get Plus until open + N days. Belongs in Money as a grant record;
        // Money serves no grant creation yet. Off unless PUZZLED_PLUS_GRACE_*
        // is set; never past its end. Remove when Money serves create-grant
        // and `plus-grace --apply` has run (docs/monetization.md).
        let entitled = entitled
            || match (user_id, &self.state.pool, &self.state.plus_grace) {
                (Some(uid), Some(pool), Some(window)) => window.allows(pool, uid, Utc::now()).await,
                _ => false,
            };
        // ---- end WORKAROUND(plus-grace-window) ---------------------------
        // Money unreachable: it cannot vouch for anyone, so nothing that is
        // free today is locked behind it.
        if !entitled {
            if let (Some(uid), Some(money)) = (user_id, self.state.money.as_ref()) {
                if money
                    .try_check(uid, crate::capabilities::money::access::FEATURE_PLUS)
                    .await
                    .is_err()
                {
                    // Intended: player experience over a small leak while Money
                    // is down. Counted so an outage-long free ride is visible.
                    tracing::warn!(
                        event = "money_entitlement_unanswerable_allowed",
                        feature = crate::capabilities::money::access::FEATURE_PLUS,
                        "Money could not answer the Plus check; play allowed"
                    );
                    return Ok(());
                }
            }
        }
        play_access(sales_open, entitled, is_today, free_today)
            .map_err(|denied| ConnectError::new(ErrorCode::PermissionDenied, denied.code()))
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

/// Deterministic mini-crossword fallback when no stored row exists.
/// Free rotation includes crossword; free floor must not depend on pre-seed.
/// Most slugs one GetTodayProgress may name (the catalogue is nineteen).
const MAX_PROGRESS_SLUGS: usize = 64;

/// Requested slugs paired with their canonical storage slug, request order kept.
fn progress_slugs(raw: &[String]) -> Result<Vec<(String, String)>, ConnectError> {
    if raw.len() > MAX_PROGRESS_SLUGS {
        return Err(ConnectError::new(
            ErrorCode::InvalidArgument,
            "too_many_games",
        ));
    }
    raw.iter()
        .map(|slug| {
            let canonical = canonicalize_game_slug(slug.trim());
            if canonical.is_empty() {
                return Err(ConnectError::new(
                    ErrorCode::InvalidArgument,
                    "game_slug_required",
                ));
            }
            if !is_valid_game_slug(canonical) {
                return Err(ConnectError::new(ErrorCode::NotFound, "unknown_game"));
            }
            Ok((slug.clone(), canonical.to_string()))
        })
        .collect()
}

/// Per-game flags in request order. A finish is reported only when the row
/// exists; nothing here carries a puzzle or an answer.
fn progress_entries(
    slugs: &[(String, String)],
    finished: &HashMap<String, CompletedSession>,
) -> Vec<GameProgress> {
    slugs
        .iter()
        .map(|(requested, canonical)| {
            let session = finished.get(canonical);
            GameProgress {
                game_slug: requested.clone(),
                has_completed: session.is_some(),
                completed_session: session
                    .map(|session| DailyCompletion {
                        status: session.status.clone(),
                        score: session.score.and_then(|score| u32::try_from(score).ok()),
                        attempts: u32::try_from(session.attempts).ok(),
                        completed_at_ms: session
                            .completed_at
                            .map(|completed_at| completed_at.and_utc().timestamp_millis()),
                        difficulty: session.difficulty.clone(),
                        ..Default::default()
                    })
                    .into(),
                ..Default::default()
            }
        })
        .collect()
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
            puzzle_data_json: client_safe_puzzle_data(puzzle_data).to_string(),
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
        let game_slug = canonicalize_game_slug(req.game_slug.trim());
        if game_slug.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "game_slug_required",
            ));
        }
        if !is_valid_game_slug(game_slug) {
            return Err(ConnectError::new(ErrorCode::NotFound, "unknown_game"));
        }

        let platform = crate::bootstrap::identity::require_identity(&ctx).ok();
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

        self.enforce_play_access(
            platform.as_ref().map(|identity| identity.user_id.as_str()),
            game_slug,
            puzzle_date,
        )
        .await?;

        // The stored puzzle for this day, generated and stored first on a miss
        // (daily pipeline, #246). Every game has one.
        let (puzzle_data, puzzle_id, stub) = match daily_pipeline::resolve(
            self.state.pool.as_ref(),
            game_slug,
            puzzle_date,
            difficulty.as_deref(),
        )
        .await
        {
            Ok(found) => (
                Some(puzzled_core::puzzle_play::generate::served_payload(
                    game_slug,
                    &found.puzzle_data,
                    &found.solution,
                )),
                found.id,
                false,
            ),
            Err(error) => {
                warn!(%error, game_slug, %puzzle_date, "get_daily puzzle unavailable");
                (None, None, true)
            }
        };

        let mut access = self.adopt_guest_progress_if_needed(&ctx, false).await?;
        let identity = access.primary().map(|identity| identity.user_id.clone());
        // Completion is server-derived from the user's sessions.
        let completed_session = match (identity.as_deref(), access.connection()) {
            (Some(uid), Some(connection)) => {
                match load_completed_session_on_connection(
                    connection,
                    uid,
                    game_slug,
                    Some(puzzle_date),
                    puzzle_id.as_deref(),
                )
                .await
                {
                    Ok(v) => v,
                    Err(error) => {
                        warn!(%error, "get_daily completed session lookup failed");
                        return Err(ConnectError::new(
                            ErrorCode::Internal,
                            "session_lookup_failed",
                        ));
                    }
                }
            }
            _ => None,
        };
        let has_completed = completed_session.is_some();

        let puzzle_data_value = puzzle_data.clone();
        let response = match build_daily_status(
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
                puzzle_data_json: puzzle_data
                    .map(client_safe_puzzle_data)
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                completed_session: completed_session
                    .map(|session| DailyCompletion {
                        status: session.status,
                        score: session.score.and_then(|score| u32::try_from(score).ok()),
                        attempts: u32::try_from(session.attempts).ok(),
                        completed_at_ms: session
                            .completed_at
                            .map(|completed_at| completed_at.and_utc().timestamp_millis()),
                        difficulty: session.difficulty,
                        ..Default::default()
                    })
                    .into(),
                ..Default::default()
            }),
            Err(404) => Err(ConnectError::new(ErrorCode::NotFound, "unknown_game")),
            Err(_) => Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "invalid_query",
            )),
        };
        if response.is_ok() {
            access.commit().await?;
        }
        response
    }

    async fn get_today_progress(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetTodayProgressRequest>,
    ) -> ServiceResult<GetTodayProgressResponse> {
        let req = request.to_owned_message();
        let slugs = progress_slugs(&req.game_slugs)?;

        let mut access = self.adopt_guest_progress_if_needed(&ctx, false).await?;
        let identity = access.primary().map(|identity| identity.user_id.clone());
        // The product day is the server's; the client never names it.
        let today = product_day_key(Utc::now());

        let finished = match (identity.as_deref(), access.connection()) {
            (Some(uid), Some(connection)) if !slugs.is_empty() => {
                let canonical: Vec<String> = slugs.iter().map(|(_, c)| c.clone()).collect();
                load_today_progress_on_connection(connection, uid, &canonical, today)
                    .await
                    .map_err(|error| {
                        warn!(%error, "get_today_progress lookup failed");
                        ConnectError::new(ErrorCode::Internal, "session_lookup_failed")
                    })?
            }
            _ => HashMap::new(),
        };
        access.commit().await?;

        Response::ok(GetTodayProgressResponse {
            day_key: today.format("%Y-%m-%d").to_string(),
            games: progress_entries(&slugs, &finished),
            ..Default::default()
        })
    }

    async fn submit_guess(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, SubmitGuessRequest>,
    ) -> ServiceResult<SubmitGuessResponse> {
        let req = request.to_owned_message();
        let game_slug = canonicalize_game_slug(req.game_slug.trim());
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
        // Platform auth **or** stable guest-day id (free-ritual protocol default).
        let platform = crate::bootstrap::identity::require_identity(&ctx).ok();
        if platform.is_none() && crate::bootstrap::identity::guest_credential_hash(&ctx).is_none() {
            return Err(ConnectError::new(
                ErrorCode::Unauthenticated,
                "identity_required_for_submit",
            ));
        }

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
        self.enforce_play_access(
            platform.as_ref().map(|identity| identity.user_id.as_str()),
            game_slug,
            date,
        )
        .await?;
        let difficulty = {
            let d = req.difficulty.trim();
            if d.is_empty() {
                None
            } else {
                Some(d.to_string())
            }
        };

        // The served puzzle: the stored row by id, else the day's stored
        // puzzle (generated and stored on a miss). The client's seed is never
        // authority.
        let (puzzle_data, solution, resolved_id) =
            match (req.puzzle_id.as_deref(), &self.state.pool) {
                (Some(pid), Some(pool)) => match fetch_puzzle_by_id(pool, pid).await {
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
                _ => match daily_pipeline::resolve(
                    self.state.pool.as_ref(),
                    game_slug,
                    date,
                    difficulty.as_deref(),
                )
                .await
                {
                    Ok(found) => (found.puzzle_data, Some(found.solution), found.id),
                    Err(error) => {
                        warn!(%error, "submit puzzle unavailable");
                        return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
                    }
                },
            };

        let Some(solution) = solution else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "puzzle_solution_unavailable",
            ));
        };

        let mut access = self.adopt_guest_progress_if_needed(&ctx, true).await?;
        let uid = access
            .primary()
            .map(|identity| identity.user_id.clone())
            .ok_or_else(|| {
                ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit")
            })?;
        // One verified finish per served puzzle **and** per free-daily
        // (user, game_slug, product day). Must not require resolved puzzle_id:
        // deterministic sudoku has no store row and sessions may store null
        // puzzle_id — dogfood residual double-finish when guard was pid-only.
        if let Some(connection) = access.connection() {
            let already = match has_completed_session_on_connection(
                &mut *connection,
                &uid,
                game_slug,
                Some(date),
                resolved_id.as_deref(),
            )
            .await
            {
                Ok(v) => v,
                Err(error) => {
                    warn!(%error, "submit completion lookup failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "session_lookup_failed",
                    ));
                }
            };
            // Ritual path: also key on day_key so a prior null-puzzle_id win
            // blocks re-submit even if puzzle_date/id wiring diverges.
            let already_ritual = if date == today {
                match has_ritual_completion_on_connection(&mut *connection, &uid, game_slug, today)
                    .await
                {
                    Ok(v) => v,
                    Err(error) => {
                        warn!(%error, "submit ritual completion lookup failed");
                        return Err(ConnectError::new(
                            ErrorCode::Internal,
                            "session_lookup_failed",
                        ));
                    }
                }
            } else {
                false
            };
            if already || already_ritual {
                return Err(ConnectError::new(
                    ErrorCode::AlreadyExists,
                    "already_played",
                ));
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
            // Dropping access rolls back any first-write allocation or adoption.
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
        if let Some(connection) = access.connection() {
            match persist_validated_session_on_connection(
                connection,
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
                Err(error) if error == "already_played" => {
                    return Err(ConnectError::new(
                        ErrorCode::AlreadyExists,
                        "already_played",
                    ));
                }
                Err(error) => {
                    warn!(%error, "submit session persist failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "session_persist_failed",
                    ));
                }
            }
        }

        access.commit().await?;
        Response::ok(SubmitGuessResponse {
            valid: true,
            status: status_label(verdict.status.unwrap_or(status)).to_string(),
            score: Some(score),
            game_slug: game_slug.to_string(),
            error: None,
            slice: SLICE_SUBMIT.to_string(),
            // The finish is accepted, so the answer may be shown now.
            reveal_json: Some(solution.to_string()),
            ..Default::default()
        })
    }

    async fn check_guess(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, CheckGuessRequest>,
    ) -> ServiceResult<CheckGuessResponse> {
        let req = request.to_owned_message();
        let game_slug = canonicalize_game_slug(req.game_slug.trim());
        if !grades_guesses(game_slug) {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "game_not_graded_per_guess",
            ));
        }
        let platform = crate::bootstrap::identity::require_identity(&ctx).ok();
        if platform.is_none() && crate::bootstrap::identity::guest_credential_hash(&ctx).is_none() {
            return Err(ConnectError::new(
                ErrorCode::Unauthenticated,
                "identity_required_for_submit",
            ));
        }
        let today = product_day_key(Utc::now());
        let date = date_from_string(req.puzzle_date.as_deref()).unwrap_or(today);
        self.enforce_play_access(
            platform.as_ref().map(|identity| identity.user_id.as_str()),
            game_slug,
            date,
        )
        .await?;
        let difficulty = Some(req.difficulty.trim()).filter(|d| !d.is_empty());
        let guess: Value = serde_json::from_str(&req.guess_json)
            .map_err(|_| ConnectError::new(ErrorCode::InvalidArgument, "invalid_guess_json"))?;
        let puzzle = match (req.puzzle_id.as_deref(), &self.state.pool) {
            (Some(pid), Some(pool)) => match fetch_puzzle_by_id(pool, pid).await {
                Ok(Some(p)) if p.game_slug == game_slug => p.solution,
                _ => None,
            },
            _ => daily_pipeline::resolve(self.state.pool.as_ref(), game_slug, date, difficulty)
                .await
                .ok()
                .map(|found| found.solution),
        };
        let Some(solution) = puzzle else {
            return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
        };
        let access = self.adopt_guest_progress_if_needed(&ctx, false).await?;
        let uid = access
            .primary()
            .map(|identity| identity.user_id.clone())
            .or_else(|| {
                crate::bootstrap::identity::guest_credential_hash(&ctx)
                    .map(|hash| format!("tok:{hash}"))
            })
            .ok_or_else(|| {
                ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit")
            })?;
        let key = format!("{uid}|{game_slug}|{date}|{}", difficulty.unwrap_or(""));
        if !self.take_guess(key, today, guess_limit(game_slug).unwrap_or(0)) {
            return Err(ConnectError::new(
                ErrorCode::ResourceExhausted,
                "guess_limit_reached",
            ));
        }
        let result = grade_guess(game_slug, &solution, &guess)
            .map_err(|error| ConnectError::new(ErrorCode::InvalidArgument, error))?;
        access.commit().await?;
        Response::ok(CheckGuessResponse {
            result_json: result.to_string(),
            ..Default::default()
        })
    }

    async fn share_result(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, ShareResultRequest>,
    ) -> ServiceResult<ShareResultResponse> {
        let req = request.to_owned_message();
        let game_slug = canonicalize_game_slug(req.game_slug.trim());
        if !is_valid_game_slug(game_slug) {
            return Err(ConnectError::new(ErrorCode::NotFound, "unknown_game"));
        }
        let mut access = self.adopt_guest_progress_if_needed(&ctx, true).await?;
        let uid = access
            .primary()
            .map(|identity| identity.user_id.clone())
            .ok_or_else(|| {
                ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit")
            })?;
        let day =
            date_from_string(req.puzzle_date.as_deref()).unwrap_or(product_day_key(Utc::now()));
        let Some(connection) = access.connection() else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "share_unavailable",
            ));
        };
        let response = match record_share_on_connection(
            &mut *connection,
            &uid,
            game_slug,
            &day.format("%Y-%m-%d").to_string(),
            req.tap,
        )
        .await
        {
            Ok(Some(id)) => {
                // A same-day share carries the sharer's streak on its card.
                if day == product_day_key(Utc::now()) {
                    match load_settled_streak_on_connection(&mut *connection, &uid, day).await {
                        Ok((streak, _, _)) if streak.current_streak > 0 => {
                            let streak = i32::try_from(streak.current_streak).unwrap_or(i32::MAX);
                            if let Err(error) =
                                set_share_streak_on_connection(&mut *connection, id, streak).await
                            {
                                warn!(%error, "share streak not stored");
                            }
                        }
                        Ok(_) => {}
                        Err(error) => warn!(%error, "share streak not read"),
                    }
                }
                Response::ok(ShareResultResponse {
                    share_id: id.to_string(),
                    ..Default::default()
                })
            }
            // Nothing to share until the player has an accepted finish.
            Ok(None) => Err(ConnectError::new(ErrorCode::NotFound, "no_finish_to_share")),
            Err(error) => {
                warn!(%error, "share_result failed");
                Err(ConnectError::new(ErrorCode::Internal, "share_failed"))
            }
        };
        if response.is_ok() {
            access.commit().await?;
        }
        response
    }

    async fn get_shared_result(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, GetSharedResultRequest>,
    ) -> ServiceResult<GetSharedResultResponse> {
        let req = request.to_owned_message();
        let id = uuid::Uuid::parse_str(req.share_id.trim())
            .map_err(|_| ConnectError::new(ErrorCode::NotFound, "share_not_found"))?;
        let Some(pool) = &self.state.pool else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "share_unavailable",
            ));
        };
        match load_shared_result(pool, id).await {
            Ok(Some(shared)) => Response::ok(GetSharedResultResponse {
                game_slug: shared.game_slug,
                puzzle_date: shared.day_key,
                difficulty: shared.difficulty.unwrap_or_default(),
                status: shared.status,
                attempts: u32::try_from(shared.attempts).unwrap_or_default(),
                score: shared.score.and_then(|v| u32::try_from(v).ok()),
                time_spent_ms: shared.time_spent_ms.and_then(|v| u64::try_from(v).ok()),
                streak: shared.streak.and_then(|v| u32::try_from(v).ok()),
                ..Default::default()
            }),
            Ok(None) => Err(ConnectError::new(ErrorCode::NotFound, "share_not_found")),
            Err(error) => {
                warn!(%error, "get_shared_result failed");
                Err(ConnectError::new(ErrorCode::Internal, "share_read_failed"))
            }
        }
    }
}

pub fn puzzle_connect_service(state: AppState) -> Arc<PuzzleConnectService> {
    Arc::new(PuzzleConnectService::new(state))
}

#[cfg(test)]
mod today_progress_tests {
    use super::*;

    fn session(score: i32) -> CompletedSession {
        CompletedSession {
            status: "won".into(),
            score: Some(score),
            attempts: 2,
            completed_at: None,
            difficulty: Some("medium".into()),
        }
    }

    #[test]
    fn aliases_resolve_to_storage_slugs_and_keep_the_requested_name() {
        let slugs = progress_slugs(&["queens".to_string(), "sudoku".to_string()]).unwrap();
        assert_eq!(slugs[0], ("queens".to_string(), "crowns".to_string()));
        assert_eq!(slugs[1].1, "sudoku");
    }

    #[test]
    fn unknown_empty_and_oversized_requests_are_refused() {
        assert!(progress_slugs(&["nope".to_string()]).is_err());
        assert!(progress_slugs(&["  ".to_string()]).is_err());
        let many = vec!["sudoku".to_string(); MAX_PROGRESS_SLUGS + 1];
        assert!(progress_slugs(&many).is_err());
    }

    #[test]
    fn only_finished_games_are_flagged_and_order_is_kept() {
        let slugs = progress_slugs(&["sudoku".to_string(), "queens".to_string()]).unwrap();
        let mut finished = HashMap::new();
        finished.insert("crowns".to_string(), session(80));
        let out = progress_entries(&slugs, &finished);
        assert_eq!(out[0].game_slug, "sudoku");
        assert!(!out[0].has_completed);
        assert!(out[0].completed_session.is_unset());
        assert_eq!(out[1].game_slug, "queens");
        assert!(out[1].has_completed);
        assert_eq!(out[1].completed_session.score, Some(80));
        assert_eq!(
            out[1].completed_session.difficulty.as_deref(),
            Some("medium")
        );
    }
}
