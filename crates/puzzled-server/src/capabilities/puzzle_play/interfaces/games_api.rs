//! Puzzle-play HTTP interfaces over pure game flows (ADR-169).
//!
//! Pure decisions live in `puzzled_core::puzzle_play::game_flows`.
//! This module owns axum handlers, SQL persistence, and clock injection.

use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::bootstrap::AppState;
use crate::capabilities::identity_access::contract::require_verified_identity;
use crate::capabilities::puzzle_play::adapters::game_sessions_db::{
    persist_game_session, PersistGameSessionInput,
};
use puzzled_core::puzzle_play::daily_time::{
    get_puzzle_number, get_today_utc, parse_date_yyyy_mm_dd, puzzle_date_string_utc,
};
use puzzled_core::puzzle_play::game_flows::{
    build_archive_dates, build_daily_status, check_archive_access, plan_save_result,
    RouteDifficulty, SaveResultInput,
};
#[cfg(test)]
use puzzled_core::puzzle_play::game_flows::{
    map_session_difficulty, ArchiveAccessError, ArchiveDateEntry, ClaimedStatus, DailyPuzzleMeta,
    DailyStatusResponse, GameMode, SaveResultError, SaveResultPlan,
};
use puzzled_core::puzzle_play::game_slugs::is_valid_game_slug;

fn domain_status(code: u16) -> StatusCode {
    StatusCode::from_u16(code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStatusQuery {
    pub game_slug: Option<String>,
    pub difficulty: Option<String>,
    /// When true, treat as already completed (store residual / dual-path hint).
    pub has_completed: Option<bool>,
    pub puzzle_id: Option<String>,
}

/// GET /api/v1/games/daily-status
pub async fn daily_status_http(Query(q): Query<DailyStatusQuery>) -> Response {
    let Some(slug) = q
        .game_slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid query parameters", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    };
    let today = get_today_utc(Utc::now());
    let completed = if q.has_completed.unwrap_or(false) {
        Some(json!({ "status": "won", "stub": true }))
    } else {
        None
    };
    match build_daily_status(
        slug,
        today,
        q.difficulty.as_deref(),
        completed,
        q.puzzle_id.clone(),
        None,
    ) {
        Ok(body) => (StatusCode::OK, Json(body)).into_response(),
        Err(404) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Unknown game: {slug}"), "slice": "api-v1-hono-monolith" })),
        )
            .into_response(),
        Err(code) => (domain_status(code),
            Json(json!({ "error": "Invalid query parameters", "slice": "api-v1-hono-monolith" })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodaysPuzzleQuery {
    pub game_slug: Option<String>,
    pub difficulty: Option<String>,
    pub puzzle_id: Option<String>,
}

/// GET /api/v1/games/todays-puzzle
pub async fn todays_puzzle_http(Query(q): Query<TodaysPuzzleQuery>) -> Response {
    let Some(slug) = q
        .game_slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return (StatusCode::OK, Json(Value::Null)).into_response();
    };
    if !is_valid_game_slug(slug) {
        return (StatusCode::OK, Json(Value::Null)).into_response();
    }
    if let Some(d) = q.difficulty.as_deref() {
        if RouteDifficulty::parse(d).is_none() {
            return (StatusCode::OK, Json(Value::Null)).into_response();
        }
    }
    let today = get_today_utc(Utc::now());
    (
        StatusCode::OK,
        Json(json!({
            "puzzleId": q.puzzle_id,
            "puzzleNumber": get_puzzle_number(today, None),
            "puzzleDate": puzzle_date_string_utc(today),
            "puzzleData": null,
            "difficulty": q.difficulty,
            "slice": "api-v1-hono-monolith",
            "stub": q.puzzle_id.is_none(),
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveAccessBody {
    pub game_slug: String,
    pub date: String,
    pub is_premium: Option<bool>,
    pub already_played: Option<bool>,
}

/// POST /api/v1/games/archive-access — product policy residual (premium + past).
pub async fn archive_access_http(Json(body): Json<ArchiveAccessBody>) -> Response {
    let today = get_today_utc(Utc::now());
    match check_archive_access(
        &body.game_slug,
        &body.date,
        today,
        body.is_premium.unwrap_or(false),
        body.already_played.unwrap_or(false),
    ) {
        Ok(d) => (
            StatusCode::OK,
            Json(json!({
                "allowed": true,
                "date": puzzle_date_string_utc(d),
                "puzzleNumber": get_puzzle_number(d, None),
                "solution": null,
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response(),
        Err(err) => (
            domain_status(err.status_code()),
            Json(json!({
                "allowed": false,
                "error": err.message(),
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResultBody {
    pub game_slug: String,
    pub status: String,
    pub attempts: u32,
    pub time_spent_ms: u64,
    pub mode: Option<String>,
    pub archive_date: Option<String>,
    pub puzzle_id: String,
    pub difficulty: Option<String>,
    pub already_played: Option<bool>,
    /// Server score when already validated (dual-oracle residual).
    pub score: Option<u32>,
    pub used_freeze: Option<bool>,
}

/// POST /api/v1/games/save-result — verified JWT + plan validation + durable write.
pub async fn save_result_http(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SaveResultBody>,
) -> Response {
    let identity = match require_verified_identity(&headers) {
        Ok(id) => id,
        Err(err) => {
            return (
                err.status(),
                Json(json!({
                    "error": err.message(),
                    "code": err.code(),
                    "slice": "api-v1-hono-monolith",
                    "auth": "platform_jwt_rs256",
                })),
            )
                .into_response();
        }
    };
    let today = get_today_utc(Utc::now());
    let input = SaveResultInput {
        game_slug: &body.game_slug,
        status: &body.status,
        attempts: body.attempts,
        time_spent_ms: body.time_spent_ms,
        mode: body.mode.as_deref(),
        archive_date: body.archive_date.as_deref(),
        puzzle_id: &body.puzzle_id,
        difficulty: body.difficulty.as_deref(),
        today,
        already_played: body.already_played.unwrap_or(false),
    };
    match plan_save_result(&input) {
        Ok(plan) => {
            let mut persisted = false;
            let mut session_id: Option<String> = None;
            if let Some(pool) = state.pool.as_ref() {
                match persist_game_session(
                    pool,
                    PersistGameSessionInput {
                        user_id: &identity.user_id,
                        score: body.score.map(|s| s as i32),
                        plan: &plan,
                    },
                )
                .await
                {
                    Ok(id) => {
                        persisted = true;
                        session_id = Some(id);
                    }
                    Err(e) => {
                        return (
                            StatusCode::SERVICE_UNAVAILABLE,
                            Json(json!({
                                "success": false,
                                "error": e,
                                "slice": "api-v1-hono-monolith",
                            })),
                        )
                            .into_response();
                    }
                }
            }
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "plan": plan,
                    "mode": plan.mode.as_str(),
                    "score": body.score,
                    "usedFreeze": body.used_freeze.unwrap_or(false),
                    "userId": identity.user_id,
                    "sessionId": session_id,
                    "persisted": persisted,
                    "stub": !persisted,
                    "serverAuthoritative": true,
                    "slice": "api-v1-hono-monolith",
                    "auth": "platform_jwt_rs256",
                })),
            )
                .into_response()
        }
        Err(err) => (
            domain_status(err.status_code()),
            Json(json!({
                "success": false,
                "error": err.message(),
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveDatesQuery {
    pub game_slug: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub is_premium: Option<bool>,
    /// Comma-separated YYYY-MM-DD dates already played.
    pub played: Option<String>,
}

/// GET /api/v1/games/archive-dates
pub async fn archive_dates_http(Query(q): Query<ArchiveDatesQuery>) -> Response {
    let Some(slug) = q
        .game_slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid query parameters", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    };
    if !q.is_premium.unwrap_or(false) {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "Archive access requires premium subscription",
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response();
    }
    if !is_valid_game_slug(slug) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Unknown game: {slug}"), "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    let start = match q
        .start_date
        .as_deref()
        .ok_or_else(|| "startDate required".to_string())
        .and_then(parse_date_yyyy_mm_dd)
    {
        Ok(d) => d,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e, "slice": "api-v1-hono-monolith" })),
            )
                .into_response();
        }
    };
    let end = match q
        .end_date
        .as_deref()
        .ok_or_else(|| "endDate required".to_string())
        .and_then(parse_date_yyyy_mm_dd)
    {
        Ok(d) => d,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e, "slice": "api-v1-hono-monolith" })),
            )
                .into_response();
        }
    };
    let played: Vec<NaiveDate> = q
        .played
        .as_deref()
        .unwrap_or("")
        .split(',')
        .filter_map(|s| parse_date_yyyy_mm_dd(s.trim()).ok())
        .collect();
    let today = get_today_utc(Utc::now());
    let entries = build_archive_dates(start, end, today, &played);
    (StatusCode::OK, Json(entries)).into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    pub game_slug: Option<String>,
    pub limit: Option<u32>,
}

/// GET /api/v1/games/history — validates query; returns empty history (DB residual).
/// HTTP: GET /api/v1/games — domain index (prod sole-process probe; not a 404).
pub async fn games_index_http() -> Response {
    let games: Vec<Value> = puzzled_core::puzzle_play::game_slugs::all_game_slugs()
        .iter()
        .map(|slug| {
            json!({
                "slug": slug,
                "href": format!("/api/v1/games/daily-status?gameSlug={slug}"),
            })
        })
        .collect();
    (
        StatusCode::OK,
        Json(json!({
            "games": games,
            "count": games.len(),
            "slice": "api-v1-hono-monolith",
            "endpoints": [
                "GET /api/v1/games/daily-status",
                "GET /api/v1/games/todays-puzzle",
                "POST /api/v1/games/archive-access",
                "POST /api/v1/games/save-result",
                "GET /api/v1/games/archive-dates",
                "GET /api/v1/games/history",
            ],
        })),
    )
        .into_response()
}

pub async fn history_http(Query(q): Query<HistoryQuery>) -> Response {
    let Some(slug) = q
        .game_slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid query parameters", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    };
    if !is_valid_game_slug(slug) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Unknown game: {slug}"), "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    let limit = q.limit.unwrap_or(20).clamp(1, 100);
    (
        StatusCode::OK,
        Json(json!({
            "gameSlug": slug,
            "limit": limit,
            "history": [],
            "stub": true,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save_input<'a>(
        game_slug: &'a str,
        status: &'a str,
        difficulty: Option<&'a str>,
        already_played: bool,
    ) -> SaveResultInput<'a> {
        SaveResultInput {
            game_slug,
            status,
            attempts: 3,
            time_spent_ms: 12_000,
            mode: Some("daily"),
            archive_date: None,
            puzzle_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            difficulty,
            today: NaiveDate::from_ymd_opt(2024, 6, 1).expect("d"),
            already_played,
        }
    }

    #[test]
    fn plan_save_rejects_abandoned() {
        let err = plan_save_result(&save_input("sudoku", "abandoned", None, false))
            .expect_err("abandoned");
        assert_eq!(err, SaveResultError::AbandonedNotValidatable);
    }

    #[test]
    fn plan_save_daily_ok() {
        let plan = plan_save_result(&save_input("sudoku", "won", Some("easy"), false)).expect("ok");
        assert_eq!(plan.mode, GameMode::Daily);
        assert_eq!(plan.difficulty.as_deref(), Some("easy"));
        assert_eq!(plan.puzzle_date, "2024-06-01");
    }

    #[test]
    fn plan_save_expert_maps_null_difficulty() {
        let plan =
            plan_save_result(&save_input("sudoku", "won", Some("expert"), false)).expect("ok");
        assert_eq!(plan.difficulty, None);
    }

    #[test]
    fn plan_save_duplicate_daily() {
        let err = plan_save_result(&save_input("sudoku", "won", None, true)).expect_err("dup");
        assert_eq!(err, SaveResultError::AlreadyPlayed);
    }

    #[test]
    fn archive_access_requires_premium() {
        let today = NaiveDate::from_ymd_opt(2024, 6, 1).expect("d");
        assert_eq!(
            check_archive_access("sudoku", "2024-05-01", today, false, false),
            Err(ArchiveAccessError::NotPremium)
        );
        assert!(check_archive_access("sudoku", "2024-05-01", today, true, false).is_ok());
    }

    #[test]
    fn daily_status_unknown_game() {
        let today = NaiveDate::from_ymd_opt(2024, 6, 1).expect("d");
        assert_eq!(
            build_daily_status("nope", today, None, None, None, None),
            Err(404)
        );
    }

    #[test]
    fn archive_dates_marks_played() {
        let today = NaiveDate::from_ymd_opt(2024, 1, 5).expect("d");
        let start = NaiveDate::from_ymd_opt(2024, 1, 1).expect("d");
        let end = NaiveDate::from_ymd_opt(2024, 1, 3).expect("d");
        let played = vec![NaiveDate::from_ymd_opt(2024, 1, 2).expect("d")];
        let entries = build_archive_dates(start, end, today, &played);
        assert_eq!(entries.len(), 3);
        assert!(!entries[0].played);
        assert!(entries[1].played);
        assert!(!entries[2].played);
    }
}
