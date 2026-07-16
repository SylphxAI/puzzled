//! Puzzled Server — ADR-168: health + leaderboard + puzzle grid/submit + product dens
//! for auth-sessions, generation jobs, platform webhooks, and Hono api-v1 monolith domains.

pub mod db_config;

mod auth_sessions;
mod backoff_pure;
mod daily_time;
mod games_api;
mod gamification_api;
mod generation_jobs;
mod platform_webhooks;
mod prefs_api;
mod roles_pure;
mod stats_api;
mod storage_keys_pure;
mod time_constants_pure;
mod validation_limits_pure;
mod app_config_pure;
mod user_profile_limits_pure;
mod html_escape_pure;
mod billing_access_pure;
mod i18n_locale_pure;
mod domain_enums_pure;
mod llm_json_parse_pure;
mod format_url_pure;
mod pii_scrub_pure;
mod flags_hash_pure;
mod key_validation_pure;
mod pkce_pure;
mod redis_keys_pure;
mod privacy_sanitize_pure;
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
use axum::routing::{get, post, put};
use axum::{Json, Router};
use auth_sessions::{get_session_http, validate_session_http};
use games_api::{
    archive_access_http, archive_dates_http, daily_status_http, games_index_http, history_http,
    save_result_http, todays_puzzle_http,
};
use gamification_api::{
    add_streak_freezes_http, streak_info_http, toggle_auto_freeze_http, try_auto_freeze_http,
};
use generation_jobs::{execute_job_http, plan_generation_http};
use leaderboard::{leaderboard_stub, stats_leaderboard};
use platform_webhooks::platform_jobs_webhook;
use prefs_api::{
    check_username_http, update_email_preferences_http, update_profile_http,
    update_push_preferences_http, update_ui_preferences_http,
};
use puzzle_grid::generate_grid;
use puzzle_submit::submit_solution;
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;
use stats_api::{today_percentile_http, user_stats_shape_http};

pub use leaderboard::LeaderboardStubBody;
pub use leaderboard_enrich::{
    cache_period_for, display_name_or_anonymous, enrich_leaderboard_entries, rank_from_better_count,
    DisplayFields, LeaderboardCachePeriod, RankScore, ANONYMOUS_DISPLAY_NAME,
};
pub use game_format::{
    calculate_wordle_score, compare_by_time, format_time_score, format_timer, is_perfect_game,
};
pub use roles_pure::{has_higher_role, has_minimum_role, is_admin_role, is_super_admin_role, role_level};
pub use storage_keys_pure::{
    get_game_session_key, namespaced_key, ANALYTICS_OFFLINE_QUEUE_KEY, CONSENT_KEY,
    CONSENT_TIMESTAMP_KEY, GUEST_GAMES_KEY, GUEST_ONBOARDING_KEY, PWA_PROMPT_DISMISSED_KEY,
    SESSION_ID_KEY, SESSION_START_KEY, SOUND_ENABLED_KEY,
};
pub use backoff_pure::{
    backoff_base_ms, calculate_backoff_delay_ms, days_ago_ms, days_to_ms, hours_ago_ms, hours_to_ms,
    is_ready_for_retry, minutes_ago_ms, minutes_to_ms, BASE_DELAY_MS, MAX_DELAY_MS,
};
pub use validation_limits_pure::{
    clamp_admin_limit, clamp_offset, clamp_user_limit, field_len_ok, is_allowed_avatar_mime,
    is_avatar_size_ok, is_batch_size_ok, is_referral_char, is_valid_referral_code,
    is_valid_username_len, normalize_currency, ADMIN_DEFAULT_LIMIT, ADMIN_MAX_LIMIT,
    AVATAR_MAX_SIZE, BIO_MAX, CONTENT_MAX, CURRENCY_CODE_LENGTH, DEFAULT_CURRENCY, DEFAULT_LIMIT,
    DESCRIPTION_MAX, MAX_BATCH_SIZE, MAX_LIMIT, NAME_MAX, OTP_CODE_LENGTH, OTP_EXPIRY_MINUTES,
    REFERRAL_CODE_MAX, REFERRAL_CODE_MIN, TITLE_MAX, USERNAME_MAX, USERNAME_MIN,
};

pub use app_config_pure::{
    email_at_domain, is_known_app_email, APP_DOMAIN, APP_NAME, DEFAULT_FROM_EMAIL, LEGAL_EMAIL,
    PRIVACY_EMAIL, SUPPORT_EMAIL,
};
pub use user_profile_limits_pure::{
    clamp_bio, is_valid_profile_bio_len, is_valid_profile_name_len, is_valid_profile_username_len,
    NAME_MAX_LENGTH,
};
pub use html_escape_pure::{escape_html, needs_escape};
pub use billing_access_pure::{
    can_access_game, day_of_year_ts_utc, free_game_for_day_of_year, has_premium_access,
    is_free_plan, is_game_free_today, is_premium_plan, todays_free_game, FREE_GAME_ROTATION,
    PREMIUM_PLANS,
};
pub use i18n_locale_pure::{
    is_chinese_locale, is_english_locale, is_valid_locale, language_from_locale, locale_country_code,
    locale_currency, locale_date_style, locale_direction, locale_fallback, locale_name,
    locale_short_name, resolve_locale, DEFAULT_LOCALE, LOCALES, LOCALE_GROUP_CHINESE,
    LOCALE_GROUP_ENGLISH,
};
pub use domain_enums_pure::{
    is_announcement_type, is_app_setting_key, is_audit_action, is_dlq_status, is_dlq_terminal,
    is_game_mode, is_game_result_status, is_game_status, is_puzzle_difficulty, is_session_active,
    is_win_back_email_type, win_back_day_offset, ANNOUNCEMENT_TYPE_VALUES, APP_SETTING_KEYS,
    AUDIT_ACTION_VALUES, DLQ_STATUS_VALUES, GAME_MODE_VALUES, GAME_RESULT_STATUSES,
    GAME_STATUS_VALUES, PUZZLE_DIFFICULTY_VALUES, WIN_BACK_EMAIL_TYPES,
};
pub use llm_json_parse_pure::{
    extract_first_json_object, is_valid_json_text, looks_like_json_start, parse_llm_json_response,
    strip_markdown_fences,
};

pub use time_constants_pure::{
    alphabet_char, alphabet_index, days_from_now_ms, days_to_seconds, hours_from_now_ms,
    hours_to_seconds, minutes_to_seconds, seconds_to_ms, weeks_to_ms, ALPHABET, DAY_SECONDS,
    HOUR_SECONDS, MINUTE_SECONDS, SECOND_MS, WEEK_MS, WEEK_SECONDS,
};
pub use pattern_match::{find_all_sets, generate_all_cards, is_valid_set, Card, Color, Fill, Shape};
pub use placement::{
    is_grid_complete as is_sudoku_grid_complete, is_valid_placement, GRID_SIZE,
};
pub use crossword_grid::{
    crossword_score, get_clue_numbers, is_crossword_grid_complete, is_grid_complete_str,
    validate_and_score as crossword_validate_and_score, validate_guess as crossword_validate_guess,
    GameResult as CrosswordGameResult, SubmissionStatus as CrosswordSubmissionStatus,
    BASE_WIN_SCORE as CROSSWORD_BASE_WIN_SCORE, CROSSWORD_GRID_SIZE,
    MIN_WIN_SCORE as CROSSWORD_MIN_WIN_SCORE,
};
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
pub use wordle_eval::{
    compare_for_percentile as word_guess_compare_for_percentile, evaluate_guess,
    format_score_display as word_guess_format_score_display, is_perfect_game as word_guess_is_perfect,
    is_winning_guess, validate_and_score as word_guess_validate_and_score, GameResult as WordGuessGameResult,
    LetterStatus, SubmissionStatus as WordGuessSubmissionStatus, MAX_GUESSES, WORD_LENGTH,
};
pub use nonogram_clues::{
    generate_clues, is_grid_complete as is_nonogram_grid_complete, nonogram_score,
    validate_and_score as nonogram_validate_and_score, validate_guess as nonogram_validate_guess,
    GameResult as NonogramGameResult, SubmissionStatus as NonogramSubmissionStatus,
    BASE_WIN_SCORE as NONOGRAM_BASE_WIN_SCORE, ERROR_PENALTY as NONOGRAM_ERROR_PENALTY,
    MIN_WIN_SCORE as NONOGRAM_MIN_WIN_SCORE,
};
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
pub use auth_sessions::{
    extract_bearer, extract_session_cookie, optional_auth, require_auth, resolve_session_token,
    validate_session, AuthError, SessionContext,
};
pub use daily_time::{
    expand_archive_dates, get_puzzle_number, get_today_utc, get_yesterday_utc,
    is_valid_archive_date, ms_until_next_utc_midnight, next_midnight_utc_date,
    puzzle_date_string_utc, time_until_next_utc_midnight, ymd, DEFAULT_LAUNCH_DATE,
};
pub use games_api::{
    build_archive_dates, build_daily_status, check_archive_access, map_session_difficulty,
    plan_save_result, ClaimedStatus, GameMode, RouteDifficulty, SaveResultError, SaveResultInput,
    SaveResultPlan,
};
pub use gamification_api::{
    add_streak_freezes, build_streak_info, toggle_auto_freeze, try_auto_freeze, FreezeData,
    FreezeReason, StreakInfo,
};
pub use generation_jobs::{
    execute_generate_daily_puzzles, execute_job, get_seed_from_date, is_known_job,
    parse_date_yyyy_mm_dd, plan_daily_generation, GenerationPlan, GenerationStrategy,
    GenerationUnit, JobResult, PuzzleDifficulty, JOB_GENERATE_DAILY_PUZZLES, LLM_GAMES,
    RUST_SEED_GAMES,
};
pub use platform_webhooks::{
    extract_job_headers, handle_platform_job, secrets_equal, verify_platform_request,
    VerificationResult, HEADER_APP_SECRET, HEADER_CRON_NAME, HEADER_JOB_ID,
};
pub use prefs_api::{
    apply_email_preferences, apply_profile_update, apply_push_preferences, apply_ui_preferences,
    is_valid_reminder_time, username_available, validate_bio, validate_username, NotificationPrefs,
    ProfilePrefs, BIO_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH,
};
pub use stats_api::{
    build_user_game_stats, compute_percentile, default_compare,
    rank_from_better_count as stats_rank_from_better_count, PercentileResult, PercentileStatsOwned,
    UserGameStats,
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
        // Product dens: auth / jobs / webhooks / generators backend
        // GET /api/v1/auth/session — prod sole-process probe path (optional session read)
        .route("/api/v1/auth/session", get(get_session_http))
        .route("/api/v1/auth/session/validate", post(validate_session_http))
        .route("/api/v1/jobs/plan", post(plan_generation_http))
        .route("/api/v1/jobs/execute", post(execute_job_http))
        .route("/api/webhooks/platform-jobs", post(platform_jobs_webhook))
        // WAVE5: Hono api-v1 monolith product dens (games/stats/user/notifications/gamification)
        // GET /api/v1/games — domain index (prod probe; must not 404)
        .route("/api/v1/games", get(games_index_http))
        .route("/api/v1/games/daily-status", get(daily_status_http))
        .route("/api/v1/games/todays-puzzle", get(todays_puzzle_http))
        .route("/api/v1/games/archive-access", post(archive_access_http))
        .route("/api/v1/games/save-result", post(save_result_http))
        .route("/api/v1/games/archive-dates", get(archive_dates_http))
        .route("/api/v1/games/history", get(history_http))
        .route("/api/v1/stats/today-percentile", get(today_percentile_http))
        .route("/api/v1/stats/user-stats/shape", post(user_stats_shape_http))
        .route("/api/v1/user/check-username", get(check_username_http))
        .route("/api/v1/user/profile", put(update_profile_http))
        .route("/api/v1/user/preferences", put(update_ui_preferences_http))
        .route(
            "/api/v1/notifications/push-preferences",
            put(update_push_preferences_http),
        )
        .route(
            "/api/v1/notifications/email-preferences",
            put(update_email_preferences_http),
        )
        .route("/api/v1/gamification/streak-info", post(streak_info_http))
        .route(
            "/api/v1/gamification/toggle-auto-freeze",
            post(toggle_auto_freeze_http),
        )
        .route(
            "/api/v1/gamification/add-streak-freezes",
            post(add_streak_freezes_http),
        )
        .route(
            "/api/v1/gamification/try-auto-freeze",
            post(try_auto_freeze_http),
        )
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
    async fn auth_session_get_returns_unauthenticated_without_credentials() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/auth/session",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("auth session request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["authenticated"], false);
        assert_eq!(json["session"], serde_json::Value::Null);
        assert_eq!(json["slice"], "auth-sessions");
    }

    #[tokio::test]
    async fn games_index_lists_registered_slugs() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(Method::GET, "/api/v1/games", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("games index request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["slice"], "api-v1-hono-monolith");
        let games = json["games"]
            .as_array()
            .expect("games array");
        assert!(games.len() >= 10);
        assert!(games.iter().any(|g| g["slug"] == "sudoku"));
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