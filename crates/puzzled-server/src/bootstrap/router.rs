//! HTTP router composition root.

use axum::routing::{get, post, put};
use axum::Router;

use crate::capabilities::generation_jobs::interfaces::{
    execute_job_http, plan_generation_http, platform_jobs_webhook,
};
use crate::capabilities::gamification::interfaces::{
    add_streak_freezes_http, streak_info_http, toggle_auto_freeze_http, try_auto_freeze_http,
};
use crate::capabilities::identity_access::interfaces::{get_session_http, validate_session_http};
use crate::capabilities::leaderboard::interfaces::{leaderboard_stub, stats_leaderboard};
use crate::capabilities::preferences::interfaces::{
    check_username_http, update_email_preferences_http, update_profile_http,
    update_push_preferences_http, update_ui_preferences_http,
};
use crate::capabilities::puzzle_play::interfaces::{
    archive_access_http, archive_dates_http, daily_status_http, games_index_http, generate_grid,
    history_http, save_result_http, submit_solution, todays_puzzle_http,
};
use crate::capabilities::stats::interfaces::{today_percentile_http, user_stats_shape_http};

use super::health::{healthz, readyz};
use super::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/api/leaderboard", get(leaderboard_stub))
        .route("/api/v1/stats/leaderboard", get(stats_leaderboard))
        .route("/api/v1/puzzles/grid", get(generate_grid))
        .route("/api/v1/puzzles/submit", post(submit_solution))
        // Auth, jobs, webhooks, and generators.
        // GET /api/v1/auth/session — prod sole-process probe path (optional session read)
        .route("/api/v1/auth/session", get(get_session_http))
        .route("/api/v1/auth/session/validate", post(validate_session_http))
        .route("/api/v1/jobs/plan", post(plan_generation_http))
        .route("/api/v1/jobs/execute", post(execute_job_http))
        .route("/api/webhooks/platform-jobs", post(platform_jobs_webhook))
        // Product domains formerly served by the Hono API.
        // GET /api/v1/games — domain index (prod probe; must not 404)
        .route("/api/v1/games", get(games_index_http))
        .route("/api/v1/games/daily-status", get(daily_status_http))
        .route("/api/v1/games/todays-puzzle", get(todays_puzzle_http))
        .route("/api/v1/games/archive-access", post(archive_access_http))
        .route("/api/v1/games/save-result", post(save_result_http))
        .route("/api/v1/games/archive-dates", get(archive_dates_http))
        .route("/api/v1/games/history", get(history_http))
        .route("/api/v1/stats/today-percentile", get(today_percentile_http))
        .route(
            "/api/v1/stats/user-stats/shape",
            post(user_stats_shape_http),
        )
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


