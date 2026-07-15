//! Puzzled Server — ADR-168 S2: health + leaderboard read + puzzle grid + solution submit.

pub mod db_config;

mod game_format;
mod game_slugs;
mod pattern_match;
mod placement;
mod crossword_grid;
mod word_hive;
mod word_box;
mod random_lcg;
mod scoring;
mod wordle_eval;
mod nonogram_clues;
mod queens_conflict;
mod word_groups;
mod word_ladder;
mod cryptogram;
mod quad_words;
mod block_slide;
mod tango;
mod arithmo;
mod killer_sudoku;
mod word_search;
mod leaderboard;
pub mod leaderboard_db;
mod leaderboard_enrich;
mod puzzle_grid;
mod puzzle_submit;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use leaderboard::{leaderboard_stub, stats_leaderboard};
use puzzle_grid::generate_grid;
use puzzle_submit::submit_solution;
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;

pub use leaderboard::LeaderboardStubBody;
pub use leaderboard_enrich::{
    cache_period_for, display_name_or_anonymous, enrich_leaderboard_entries, rank_from_better_count,
    DisplayFields, LeaderboardCachePeriod, RankScore, ANONYMOUS_DISPLAY_NAME,
};
pub use game_format::{
    calculate_wordle_score, compare_by_time, format_time_score, format_timer, is_perfect_game,
};
pub use pattern_match::{find_all_sets, generate_all_cards, is_valid_set, Card, Color, Fill, Shape};
pub use placement::{
    is_grid_complete as is_sudoku_grid_complete, is_valid_placement, GRID_SIZE,
};
pub use crossword_grid::{is_crossword_grid_complete, CROSSWORD_GRID_SIZE};
pub use word_hive::{
    calculate_word_score, get_next_rank_threshold, get_rank_for_score, is_one_letter_change,
    validate_and_score as word_hive_validate_and_score, GameResult as WordHiveGameResult,
    MIN_WORD_LENGTH,
};
pub use word_box::{
    all_letters_used, get_used_letters, has_valid_side_transitions, starts_with_last_letter,
    uses_valid_letters, validate_and_score as word_box_validate_and_score, word_box_score,
    GameResult as WordBoxGameResult, LetterBox, SubmissionStatus as WordBoxSubmissionStatus,
};
pub use random_lcg::{pick_random, shuffle_array, SeededRandom};
pub use scoring::{validate_and_score, GameResult, GameSubmission, SubmissionStatus};
pub use wordle_eval::{evaluate_guess, is_winning_guess, LetterStatus, MAX_GUESSES, WORD_LENGTH};
pub use nonogram_clues::{generate_clues, is_grid_complete as is_nonogram_grid_complete};
pub use queens_conflict::{
    get_conflicts, is_solved, queens_score, validate_and_score as queens_validate_and_score,
    Cell as QueensCell, GameResult as QueensGameResult, SubmissionStatus as QueensSubmissionStatus,
    BASE_WIN_SCORE as QUEENS_BASE_WIN_SCORE, MIN_WIN_SCORE as QUEENS_MIN_WIN_SCORE,
};
pub use word_groups::{
    count_matching_words, find_matching_category, validate_and_score as word_groups_validate_and_score,
    word_groups_score, Category as WordGroupsCategory, GameResult as WordGroupsGameResult,
    SubmissionStatus as WordGroupsSubmissionStatus, MAX_MISTAKES, TOTAL_CATEGORIES,
    WORDS_PER_CATEGORY,
};
pub use word_ladder::{
    is_one_letter_change as is_word_ladder_one_letter_change,
    validate_and_score as word_ladder_validate_and_score, word_ladder_score,
    GameResult as WordLadderGameResult, SubmissionStatus as WordLadderSubmissionStatus,
    BASE_WIN_SCORE as WORD_LADDER_BASE_WIN_SCORE, EXTRA_STEP_PENALTY as WORD_LADDER_EXTRA_STEP_PENALTY,
    MIN_WIN_SCORE as WORD_LADDER_MIN_WIN_SCORE,
};
pub use cryptogram::{
    cryptogram_score, is_fully_solved, unique_encrypted_letters,
    validate_and_score as cryptogram_validate_and_score, GameResult as CryptogramGameResult,
    SubmissionStatus as CryptogramSubmissionStatus, BASE_WIN_SCORE as CRYPTOGRAM_BASE_WIN_SCORE,
    HINT_PENALTY as CRYPTOGRAM_HINT_PENALTY, MIN_WIN_SCORE as CRYPTOGRAM_MIN_WIN_SCORE,
};
pub use quad_words::{
    evaluate_four, get_best_status, guess_solves_target, quad_words_score,
    validate_and_score as quad_words_validate_and_score, GameResult as QuadWordsGameResult,
    SubmissionStatus as QuadWordsSubmissionStatus, MAX_GUESSES as QUAD_WORDS_MAX_GUESSES,
    MIN_WIN_SCORE as QUAD_WORDS_MIN_WIN_SCORE, OPTIMAL_GUESSES as QUAD_WORDS_OPTIMAL_GUESSES,
};
pub use block_slide::{
    block_slide_score, can_move, is_valid_configuration, is_win, move_block, serialize_state,
    solve_puzzle, validate_and_score as block_slide_validate_and_score, Block, BlockSlidePuzzle,
    Direction as BlockSlideDirection, GameResult as BlockSlideGameResult, SolveResult,
    SubmissionStatus as BlockSlideSubmissionStatus, BASE_WIN_SCORE as BLOCK_SLIDE_BASE_WIN_SCORE,
    DEFAULT_MAX_MOVES as BLOCK_SLIDE_DEFAULT_MAX_MOVES, EXTRA_MOVE_PENALTY as BLOCK_SLIDE_EXTRA_MOVE_PENALTY,
    FAST_SOLVE_BONUS as BLOCK_SLIDE_FAST_SOLVE_BONUS, FAST_SOLVE_MS as BLOCK_SLIDE_FAST_SOLVE_MS,
    MIN_WIN_SCORE as BLOCK_SLIDE_MIN_WIN_SCORE,
};
pub use tango::{
    get_conflicts as tango_get_conflicts, has_consecutive_violation, is_solved as tango_is_solved,
    tango_score, validate_and_score as tango_validate_and_score, CellValue as TangoCellValue,
    GameResult as TangoGameResult, SubmissionStatus as TangoSubmissionStatus,
    BASE_WIN_SCORE as TANGO_BASE_WIN_SCORE, MAX_CONSECUTIVE as TANGO_MAX_CONSECUTIVE,
    MIN_WIN_SCORE as TANGO_MIN_WIN_SCORE,
};
pub use arithmo::{
    arithmo_score, get_guess_result as arithmo_get_guess_result, is_valid_equation,
    validate_and_score as arithmo_validate_and_score, CharStatus as ArithmoCharStatus,
    GameResult as ArithmoGameResult, SubmissionStatus as ArithmoSubmissionStatus,
    EQUATION_LENGTH as ARITHMO_EQUATION_LENGTH, MAX_ATTEMPTS as ARITHMO_MAX_ATTEMPTS,
};
pub use killer_sudoku::{
    grid_matches_solution as killer_grid_matches_solution, killer_sudoku_score,
    validate_and_score as killer_sudoku_validate_and_score, GameResult as KillerSudokuGameResult,
    SubmissionStatus as KillerSudokuSubmissionStatus, BASE_WIN_SCORE as KILLER_BASE_WIN_SCORE,
    GRID_SIZE as KILLER_GRID_SIZE, MIN_WIN_SCORE as KILLER_MIN_WIN_SCORE,
};
pub use word_search::{
    validate_and_score as word_search_validate_and_score, word_search_score,
    GameResult as WordSearchGameResult, SubmissionStatus as WordSearchSubmissionStatus,
    BASE_WIN_SCORE as WORD_SEARCH_BASE_WIN_SCORE, MIN_WIN_SCORE as WORD_SEARCH_MIN_WIN_SCORE,
};

static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

#[derive(Clone)]
pub struct AppState {
    started_at: Instant,
    pub pool: Option<PgPool>,
}

impl AppState {
    #[must_use]
    pub fn new(pool: Option<PgPool>) -> Self {
        Self {
            started_at: Instant::now(),
            pool,
        }
    }

    #[must_use]
    pub fn uptime_secs(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new(None)
    }
}

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
}

pub fn request_shutdown() {
    SHUTTING_DOWN.store(true, Ordering::Relaxed);
}

fn shutting_down() -> bool {
    SHUTTING_DOWN.load(Ordering::Relaxed)
}

async fn healthz() -> Response {
    if shutting_down() {
        return (StatusCode::SERVICE_UNAVAILABLE, "shutting down").into_response();
    }
    (StatusCode::OK, Json(HealthBody { status: "ok" })).into_response()
}

async fn readyz(State(state): State<AppState>) -> Response {
    if shutting_down() {
        return (StatusCode::SERVICE_UNAVAILABLE, "shutting down").into_response();
    }

    let slice = if state.pool.is_some() { "S1" } else { "S0" };
    let postgres_ok = if let Some(pool) = &state.pool {
        postgres_ping(pool).await
    } else {
        false
    };

    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "uptime_s": state.uptime_secs(),
            "slice": slice,
            "dependencies": [
                {
                    "name": "postgres",
                    "ok": postgres_ok,
                    "detail": "sqlx leaderboard read (ADR-168 S1)"
                }
            ],
            "stub": state.pool.is_none(),
        })),
    )
        .into_response()
}

async fn postgres_ping(pool: &PgPool) -> bool {
    tokio::time::timeout(
        Duration::from_millis(500),
        sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(pool),
    )
    .await
    .ok()
    .and_then(Result::ok)
    .is_some()
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/api/leaderboard", get(leaderboard_stub))
        .route("/api/v1/stats/leaderboard", get(stats_leaderboard))
        .route("/api/v1/puzzles/grid", get(generate_grid))
        .route("/api/v1/puzzles/submit", post(submit_solution))
        .with_state(state)
}

#[must_use]
pub fn http_port() -> u16 {
    std::env::var("PUZZLED_HTTP_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8080)
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(error) => tracing::error!(%error, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => tracing::info!("shutdown signal received: SIGINT"),
        () = terminate => tracing::info!("shutdown signal received: SIGTERM"),
    }

    request_shutdown();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{Method, Request};
    use tower::ServiceExt;

    fn build_request(method: Method, uri: &str, body: Body) -> Request<Body> {
        let method_name = method.as_str().to_owned();
        match Request::builder().method(method).uri(uri).body(body) {
            Ok(request) => request,
            Err(error) => panic!("build request {method_name} {uri}: {error}"),
        }
    }

    async fn body_json(response: Response) -> serde_json::Value {
        let body = match to_bytes(response.into_body(), usize::MAX).await {
            Ok(body) => body,
            Err(error) => panic!("read body: {error}"),
        };
        match serde_json::from_slice(&body) {
            Ok(json) => json,
            Err(error) => panic!("parse json: {error}"),
        }
    }

    #[tokio::test]
    async fn healthz_returns_ok_json() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(Method::GET, "/healthz", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("healthz request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["status"], "ok");
    }

    #[tokio::test]
    async fn domain_stub_returns_contract() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(Method::GET, "/api/leaderboard", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("stub request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json["entries"].as_array().is_some_and(|entries| entries.is_empty()));
        assert_eq!(json["stub"], true);
    }

    #[tokio::test]
    async fn stats_leaderboard_invalid_query_returns_empty_array() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/stats/leaderboard",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("leaderboard request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json.as_array().is_some_and(|entries| entries.is_empty()));
    }

    #[tokio::test]
    async fn stats_leaderboard_streak_returns_empty_array_without_db() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/stats/leaderboard?gameSlug=sudoku&type=streak",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("leaderboard request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json.as_array().is_some_and(|entries| entries.is_empty()));
    }
}