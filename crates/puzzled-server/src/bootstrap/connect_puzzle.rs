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
use puzzled_core::puzzle_play::arithmo;
use puzzled_core::puzzle_play::arithmo_generate::generate_arithmo_puzzle;
use puzzled_core::puzzle_play::block_slide_generate::generate_block_slide_puzzle;
use puzzled_core::puzzle_play::crossword_generate::{
    client_safe_puzzle_data, client_safe_served_puzzle, generate_crossword_puzzle,
};
use puzzled_core::puzzle_play::cryptogram_generate::generate_cryptogram_puzzle;
use puzzled_core::puzzle_play::daily_time::{get_puzzle_number, product_day_key};
use puzzled_core::puzzle_play::domain::scoring::SubmissionStatus;
use puzzled_core::puzzle_play::game_flows::build_daily_status;
use puzzled_core::puzzle_play::game_slugs::{
    canonicalize_game_slug, is_game_free_today, is_valid_game_slug,
};
use puzzled_core::puzzle_play::killer_sudoku_generate::generate_killer_sudoku_puzzle;
use puzzled_core::puzzle_play::nonogram_generate::generate_nonogram_puzzle;
use puzzled_core::puzzle_play::pattern_match_generate::generate_pattern_match_puzzle;
use puzzled_core::puzzle_play::quad_words;
use puzzled_core::puzzle_play::quad_words_generate::generate_quad_words_puzzle;
use puzzled_core::puzzle_play::queens_generate::{generate_queens_puzzle, queens_board_size};
use puzzled_core::puzzle_play::tango_generate::generate_duo_puzzle;
use puzzled_core::puzzle_play::word_groups;
use puzzled_core::puzzle_play::word_groups_generate::generate_word_groups_puzzle;
use puzzled_core::puzzle_play::word_guess_generate::generate_word_guess_puzzle;
use puzzled_core::puzzle_play::word_hive;
use puzzled_core::puzzle_play::word_search_generate::generate_word_search_puzzle;
use puzzled_core::puzzle_play::wordle_eval;
use puzzled_core::{generate_sudoku_puzzle, SudokuDifficulty};

use super::state::AppState;
use crate::capabilities::puzzle_play::adapters::daily_puzzles_db::{
    fetch_daily_puzzle, fetch_puzzle_by_id,
};
use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    has_completed_session, has_ritual_completion, load_completed_session, persist_validated_session,
};
use crate::proto::puzzled::v1::{
    DailyCompletion, GetDailyRequest, GetDailyResponse, GetPuzzleRequest, GetPuzzleResponse,
    PuzzleService, SubmitGuessRequest, SubmitGuessResponse,
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
        use crate::bootstrap::identity::require_identity_or_guest;
        // Platform JWT/session or stable guest-day id (for has_completed).
        // Pure anonymous (no JWT, no guest id) → None for free-floor reads.
        match require_identity_or_guest(ctx) {
            Ok(identity) => Ok(Some(identity.user_id)),
            Err(_) => Ok(None),
        }
    }

    /// SubmitGuess identity: Platform JWT/session **or** guest-day id.
    fn identity_for_submit(&self, ctx: &RequestContext) -> Result<String, ConnectError> {
        use crate::bootstrap::identity::require_identity_or_guest;
        Ok(require_identity_or_guest(ctx)?.user_id)
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

/// Deterministic mini-crossword fallback when no stored row exists.
/// Free rotation includes crossword; free floor must not depend on pre-seed.
fn crossword_puzzle_data(seed: i64) -> Value {
    generate_crossword_puzzle(seed).0
}

fn crossword_solution(seed: i64) -> Value {
    generate_crossword_puzzle(seed).1
}

fn crowns_puzzle_data(seed: i64, difficulty: Option<&str>) -> Value {
    let generated = generate_queens_puzzle(seed, queens_board_size(difficulty));
    serde_json::to_value(&generated.puzzle_data).unwrap_or(Value::Null)
}

fn crowns_solution(seed: i64, difficulty: Option<&str>) -> Value {
    let generated = generate_queens_puzzle(seed, queens_board_size(difficulty));
    serde_json::to_value(&generated.solution).unwrap_or(Value::Null)
}

fn word_guess_puzzle_data(seed: i64) -> Value {
    generate_word_guess_puzzle(seed).0
}

fn word_guess_solution(seed: i64) -> Value {
    generate_word_guess_puzzle(seed).1
}

fn word_guess_evaluation_json(eval: &wordle_eval::GuessEvaluation) -> String {
    serde_json::json!({
        "letters": eval.letters.iter().map(|status| status.as_str()).collect::<Vec<_>>(),
        "won": eval.won,
        "terminal": eval.terminal,
        "reveal": eval.reveal,
    })
    .to_string()
}

fn parse_word_groups_categories(solution: &Value) -> Option<Vec<word_groups::Category>> {
    let cats = solution.get("categories")?.as_array()?;
    let mut categories = Vec::with_capacity(cats.len());
    for category in cats {
        categories.push(word_groups::Category {
            name: category.get("name")?.as_str()?.to_string(),
            words: category
                .get("words")?
                .as_array()?
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect(),
            level: u8::try_from(category.get("level").and_then(Value::as_u64).unwrap_or(0))
                .unwrap_or(0),
        });
    }
    Some(categories)
}

fn arithmo_playing_response(
    game_slug: &str,
    solution: &Value,
    data: &Value,
) -> ServiceResult<SubmitGuessResponse> {
    let Some(equation) = solution.get("equation").and_then(Value::as_str) else {
        return Err(ConnectError::new(
            ErrorCode::InvalidArgument,
            "missing_solution_equation",
        ));
    };
    let Some(guesses) = word_guess_guesses(data) else {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some("Missing guesses data".to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    };
    let Some(eval) = arithmo::evaluate_latest_equation(equation, &guesses) else {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some("invalid_guess".to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    };
    Response::ok(SubmitGuessResponse {
        valid: true,
        status: if eval.terminal {
            if eval.won {
                "won"
            } else {
                "lost"
            }
        } else {
            "playing"
        }
        .to_string(),
        score: None,
        game_slug: game_slug.to_string(),
        error: None,
        slice: SLICE_SUBMIT.to_string(),
        evaluation_json: Some(
            serde_json::json!({
                "letters": eval.letters.iter().map(|status| status.as_str()).collect::<Vec<_>>(),
                "won": eval.won,
                "terminal": eval.terminal,
                "reveal": eval.reveal,
            })
            .to_string(),
        ),
        ..Default::default()
    })
}

fn quad_words_playing_response(
    game_slug: &str,
    solution: &Value,
    data: &Value,
) -> ServiceResult<SubmitGuessResponse> {
    let Some(words) = solution.get("words").and_then(Value::as_array) else {
        return Err(ConnectError::new(
            ErrorCode::InvalidArgument,
            "missing_quad_words_solution",
        ));
    };
    let targets: Vec<String> = words
        .iter()
        .filter_map(Value::as_str)
        .map(ToOwned::to_owned)
        .collect();
    if targets.len() != 4 {
        return Err(ConnectError::new(
            ErrorCode::InvalidArgument,
            "invalid_quad_words_solution",
        ));
    }
    let Some(guesses) = word_guess_guesses(data) else {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some("Missing guesses data".to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    };
    let target_refs = [
        targets[0].as_str(),
        targets[1].as_str(),
        targets[2].as_str(),
        targets[3].as_str(),
    ];
    let mut previously_solved = [false; 4];
    if guesses.len() > 1 {
        for guess in &guesses[..guesses.len() - 1] {
            if let Some(boards) = quad_words::evaluate_four(guess, &target_refs) {
                for (index, letters) in boards.iter().enumerate() {
                    if wordle_eval::is_winning_guess(letters) {
                        previously_solved[index] = true;
                    }
                }
            }
        }
    }
    let Some(eval) = quad_words::evaluate_latest_quad(&target_refs, &guesses, previously_solved)
    else {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some("invalid_guess".to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    };
    Response::ok(SubmitGuessResponse {
        valid: true,
        status: if eval.terminal {
            if eval.won {
                "won"
            } else {
                "lost"
            }
        } else {
            "playing"
        }
        .to_string(),
        score: None,
        game_slug: game_slug.to_string(),
        error: None,
        slice: SLICE_SUBMIT.to_string(),
        evaluation_json: Some(
            serde_json::json!({
                "boards": eval.boards.iter().map(|board| {
                    board.iter().map(|status| status.as_str()).collect::<Vec<_>>()
                }).collect::<Vec<_>>(),
                "solved": eval.solved,
                "won": eval.won,
                "terminal": eval.terminal,
                "reveal": eval.reveal,
            })
            .to_string(),
        ),
        ..Default::default()
    })
}

fn word_groups_playing_response(
    game_slug: &str,
    solution: &Value,
    data: &Value,
) -> ServiceResult<SubmitGuessResponse> {
    let Some(categories) = parse_word_groups_categories(solution) else {
        return Err(ConnectError::new(
            ErrorCode::InvalidArgument,
            "missing_categories_solution",
        ));
    };
    let Some(guess) = data.get("guess").and_then(Value::as_array).map(|items| {
        items
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>()
    }) else {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some("Missing guess data".to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    };
    let found_names = data
        .get("foundNames")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let eval = word_groups::evaluate_group_guess(&guess, &categories, &found_names);
    let category = eval.category.as_ref().map(|category| {
        serde_json::json!({
            "name": category.name,
            "words": category.words,
            "level": category.level,
        })
    });
    let mistakes = data.get("mistakes").and_then(Value::as_u64).unwrap_or(0);
    let remaining = if !eval.correct && mistakes + 1 >= u64::from(word_groups::MAX_MISTAKES) {
        Some(
            categories
                .iter()
                .filter(|category| {
                    !found_names
                        .iter()
                        .any(|name| name.eq_ignore_ascii_case(&category.name))
                })
                .map(|category| {
                    serde_json::json!({
                        "name": category.name,
                        "words": category.words,
                        "level": category.level,
                    })
                })
                .collect::<Vec<_>>(),
        )
    } else {
        None
    };
    Response::ok(SubmitGuessResponse {
        valid: true,
        status: "playing".to_string(),
        score: None,
        game_slug: game_slug.to_string(),
        error: None,
        slice: SLICE_SUBMIT.to_string(),
        evaluation_json: Some(
            serde_json::json!({
                "correct": eval.correct,
                "oneAway": eval.one_away,
                "category": category,
                "remaining": remaining,
            })
            .to_string(),
        ),
        ..Default::default()
    })
}

fn word_hive_playing_response(
    game_slug: &str,
    solution: &Value,
    data: &Value,
) -> ServiceResult<SubmitGuessResponse> {
    let mut valid_words = std::collections::HashSet::new();
    let mut pangrams = std::collections::HashSet::new();
    if let Some(list) = solution.get("validWords").and_then(Value::as_array) {
        for word in list.iter().filter_map(Value::as_str) {
            valid_words.insert(word.to_ascii_uppercase());
        }
    }
    if let Some(list) = solution.get("pangrams").and_then(Value::as_array) {
        for word in list.iter().filter_map(Value::as_str) {
            pangrams.insert(word.to_ascii_uppercase());
        }
    }
    if valid_words.is_empty() {
        return Err(ConnectError::new(
            ErrorCode::InvalidArgument,
            "missing_hive_solution",
        ));
    }
    let Some(found) = data
        .get("foundWords")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
    else {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some("Missing found words data".to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    };
    let Some(eval) = word_hive::evaluate_latest_word(&valid_words, &pangrams, &found) else {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some("invalid_guess".to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    };
    if !eval.accepted {
        return Response::ok(SubmitGuessResponse {
            valid: false,
            status: String::new(),
            score: None,
            game_slug: game_slug.to_string(),
            error: Some(eval.error.unwrap_or("not_in_list").to_string()),
            slice: SLICE_SUBMIT.to_string(),
            ..Default::default()
        });
    }
    Response::ok(SubmitGuessResponse {
        valid: true,
        status: if eval.terminal { "won" } else { "playing" }.to_string(),
        score: None,
        game_slug: game_slug.to_string(),
        error: None,
        slice: SLICE_SUBMIT.to_string(),
        evaluation_json: Some(
            serde_json::json!({
                "word": eval.word,
                "wordScore": eval.word_score,
                "isPangram": eval.is_pangram,
                "foundCount": eval.found_count,
                "totalWords": eval.total_words,
                "terminal": eval.terminal,
            })
            .to_string(),
        ),
        ..Default::default()
    })
}

fn word_guess_guesses(data: &Value) -> Option<Vec<String>> {
    data.get("guesses").and_then(Value::as_array).map(|items| {
        items
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect()
    })
}

/// On-server deterministic fallback for free-floor modules that ship a pure generator.
/// Content store remains preferred when a row exists. Crowns is in the free
/// rotation; the floor must not depend on a pre-seeded row.
fn deterministic_daily(
    game_slug: &str,
    seed: i64,
    difficulty: Option<&str>,
) -> Option<(Value, Option<Value>)> {
    match game_slug {
        "sudoku" => {
            let diff = parse_difficulty(difficulty.unwrap_or("medium"));
            Some((
                sudoku_puzzle_data(seed, diff),
                Some(sudoku_solution(seed, diff)),
            ))
        }
        "crossword" => Some((crossword_puzzle_data(seed), Some(crossword_solution(seed)))),
        "crowns" => Some((
            crowns_puzzle_data(seed, difficulty),
            Some(crowns_solution(seed, difficulty)),
        )),
        "word-guess" => Some((
            word_guess_puzzle_data(seed),
            Some(word_guess_solution(seed)),
        )),
        "word-groups" => Some((
            generate_word_groups_puzzle(seed).0,
            Some(generate_word_groups_puzzle(seed).1),
        )),
        "arithmo" => {
            let (data, solution) = generate_arithmo_puzzle(seed);
            Some((data, Some(solution)))
        }
        "quad-words" => {
            let (data, solution) = generate_quad_words_puzzle(seed);
            Some((data, Some(solution)))
        }
        "pattern-match" => {
            let (data, solution) = generate_pattern_match_puzzle(seed);
            Some((data, Some(solution)))
        }
        "cryptogram" => {
            let (data, solution) = generate_cryptogram_puzzle(seed);
            Some((data, Some(solution)))
        }
        "duo" => {
            let (data, solution) = generate_duo_puzzle(seed);
            Some((data, Some(solution)))
        }
        "nonogram" => {
            let (data, solution) = generate_nonogram_puzzle(seed);
            Some((data, Some(solution)))
        }
        "word-search" => {
            let (data, solution) = generate_word_search_puzzle(seed);
            Some((data, Some(solution)))
        }
        "killer-sudoku" => {
            let (data, solution) = generate_killer_sudoku_puzzle(seed, difficulty);
            Some((data, Some(solution)))
        }
        "block-slide" => {
            let (data, solution) = generate_block_slide_puzzle(seed, difficulty);
            Some((data, Some(solution)))
        }
        _ => None,
    }
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

        // Resolve the served puzzle: stored row first, then documented
        // deterministic generators (sudoku, crossword free-floor).
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
        if puzzle_data.is_none() {
            let seed = i64::from(get_puzzle_number(puzzle_date, None));
            if let Some((data, _)) = deterministic_daily(game_slug, seed, difficulty.as_deref()) {
                puzzle_data = Some(data);
                stub = false;
            }
        }

        // Completion is server-derived from the user's sessions.
        let completed_session = match (identity.as_deref(), &self.state.pool) {
            (Some(uid), Some(pool)) => {
                match load_completed_session(
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
                puzzle_data_json: puzzle_data
                    .map(|data| client_safe_served_puzzle(game_slug, data))
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
        }
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
        let playing = req.status.trim().eq_ignore_ascii_case("playing");
        let status = parse_status(&req.status);
        if status.is_none() && !playing {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "status_required_won_or_lost",
            ));
        }
        if playing
            && game_slug != "word-guess"
            && game_slug != "word-groups"
            && game_slug != "arithmo"
            && game_slug != "quad-words"
            && game_slug != "word-hive"
        {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "status_required_won_or_lost",
            ));
        }
        // Platform auth **or** stable guest-day id (free-ritual protocol default).
        // Premium/archive still fail closed via enforce_play_access.
        let uid = self.identity_for_submit(&ctx)?;

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
        // deterministic free-floor generators. The client's seed is never authority.
        let seed = i64::from(get_puzzle_number(date, None));
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
                None => match deterministic_daily(game_slug, seed, difficulty.as_deref()) {
                    Some((data, sol)) => (data, sol, None),
                    None => {
                        return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
                    }
                },
            }
        } else if let Some(pool) = &self.state.pool {
            match fetch_daily_puzzle(pool, game_slug, date, difficulty.as_deref()).await {
                Ok(Some(p)) => (p.puzzle_data, p.solution, Some(p.id.to_string())),
                Ok(None) => match deterministic_daily(game_slug, seed, difficulty.as_deref()) {
                    Some((data, sol)) => (data, sol, None),
                    None => {
                        return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
                    }
                },
                Err(error) => {
                    warn!(%error, "submit puzzle lookup failed");
                    return Err(ConnectError::new(
                        ErrorCode::Internal,
                        "puzzle_lookup_failed",
                    ));
                }
            }
        } else {
            match deterministic_daily(game_slug, seed, difficulty.as_deref()) {
                Some((data, sol)) => (data, sol, None),
                None => {
                    return Err(ConnectError::new(ErrorCode::NotFound, "puzzle_unavailable"));
                }
            }
        };

        let Some(solution) = solution else {
            return Err(ConnectError::new(
                ErrorCode::Unavailable,
                "puzzle_solution_unavailable",
            ));
        };

        // One verified finish per served puzzle **and** per free-daily
        // (user, game_slug, product day). Must not require resolved puzzle_id:
        // deterministic sudoku has no store row and sessions may store null
        // puzzle_id — dogfood residual double-finish when guard was pid-only.
        if let Some(pool) = &self.state.pool {
            let already = match has_completed_session(
                pool,
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
                match has_ritual_completion(pool, &uid, game_slug, today).await {
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

        if playing {
            if game_slug == "word-groups" {
                return word_groups_playing_response(game_slug, &solution, &data);
            }
            if game_slug == "arithmo" {
                return arithmo_playing_response(game_slug, &solution, &data);
            }
            if game_slug == "quad-words" {
                return quad_words_playing_response(game_slug, &solution, &data);
            }
            if game_slug == "word-hive" {
                return word_hive_playing_response(game_slug, &solution, &data);
            }
            let Some(word) = solution.get("word").and_then(Value::as_str) else {
                return Err(ConnectError::new(
                    ErrorCode::InvalidArgument,
                    "missing_solution_word",
                ));
            };
            let Some(guesses) = word_guess_guesses(&data) else {
                return Response::ok(SubmitGuessResponse {
                    valid: false,
                    status: String::new(),
                    score: None,
                    game_slug: game_slug.to_string(),
                    error: Some("Missing guesses data".to_string()),
                    slice: SLICE_SUBMIT.to_string(),
                    ..Default::default()
                });
            };
            let Some(eval) = wordle_eval::evaluate_latest_guess(word, &guesses) else {
                return Response::ok(SubmitGuessResponse {
                    valid: false,
                    status: String::new(),
                    score: None,
                    game_slug: game_slug.to_string(),
                    error: Some("invalid_guess".to_string()),
                    slice: SLICE_SUBMIT.to_string(),
                    ..Default::default()
                });
            };
            return Response::ok(SubmitGuessResponse {
                valid: true,
                status: if eval.terminal {
                    if eval.won {
                        "won"
                    } else {
                        "lost"
                    }
                } else {
                    "playing"
                }
                .to_string(),
                score: None,
                game_slug: game_slug.to_string(),
                error: None,
                slice: SLICE_SUBMIT.to_string(),
                evaluation_json: Some(word_guess_evaluation_json(&eval)),
                ..Default::default()
            });
        }

        let Some(status) = status else {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "status_required_won_or_lost",
            ));
        };

        let envelope = SubmissionEnvelope {
            status,
            attempts: req.attempts,
            time_spent_ms: req.time_spent_ms,
            data: data.clone(),
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

        let evaluation_json = if game_slug == "word-guess" {
            solution
                .get("word")
                .and_then(Value::as_str)
                .and_then(|word| {
                    word_guess_guesses(&data)
                        .and_then(|guesses| wordle_eval::evaluate_latest_guess(word, &guesses))
                })
                .map(|eval| word_guess_evaluation_json(&eval))
        } else {
            None
        };

        Response::ok(SubmitGuessResponse {
            valid: true,
            status: status_label(verdict.status.unwrap_or(status)).to_string(),
            score: Some(score),
            game_slug: game_slug.to_string(),
            error: None,
            slice: SLICE_SUBMIT.to_string(),
            evaluation_json,
            ..Default::default()
        })
    }
}

pub fn puzzle_connect_service(state: AppState) -> Arc<PuzzleConnectService> {
    Arc::new(PuzzleConnectService::new(state))
}
