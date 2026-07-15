//! Hono games domain product dens (`api-v1-hono-monolith` /games/*).
//!
//! Ports request validation, mode/difficulty mapping, archive access policy,
//! and daily-status envelope construction from
//! `apps/puzzled/src/server/api/routes/games.ts`.
//!
//! DB materialization of puzzles/sessions remains dual-path residual (sqlx
//! optional); scoring kernels already live in sibling modules. Platform SDK
//! streak/score side-effects stay client-side (TS oracle).

use axum::extract::Query;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::daily_time::{
    expand_archive_dates, get_puzzle_number, get_today_utc, is_valid_archive_date,
    parse_date_yyyy_mm_dd, puzzle_date_string_utc,
};
use crate::game_slugs::is_valid_game_slug;

/// Game play mode (parity: `GAME_MODE_VALUES`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GameMode {
    Daily,
    Archive,
    Practice,
}

impl GameMode {
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "daily" => Some(Self::Daily),
            "archive" => Some(Self::Archive),
            "practice" => Some(Self::Practice),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Daily => "daily",
            Self::Archive => "archive",
            Self::Practice => "practice",
        }
    }
}

/// Client-claimed result status (parity: `GAME_RESULT_STATUSES`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClaimedStatus {
    Won,
    Lost,
    Abandoned,
}

impl ClaimedStatus {
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "won" => Some(Self::Won),
            "lost" => Some(Self::Lost),
            "abandoned" => Some(Self::Abandoned),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Won => "won",
            Self::Lost => "lost",
            Self::Abandoned => "abandoned",
        }
    }

    /// Abandoned cannot be server-validated (TS parity).
    #[must_use]
    pub fn is_validatable(self) -> bool {
        !matches!(self, Self::Abandoned)
    }
}

/// Puzzle difficulty labels accepted by games routes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RouteDifficulty {
    Easy,
    Medium,
    Hard,
    Expert,
}

impl RouteDifficulty {
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "easy" => Some(Self::Easy),
            "medium" => Some(Self::Medium),
            "hard" => Some(Self::Hard),
            "expert" => Some(Self::Expert),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Easy => "easy",
            Self::Medium => "medium",
            Self::Hard => "hard",
            Self::Expert => "expert",
        }
    }

    /// Expert maps to NULL difficulty in DB (TS parity).
    #[must_use]
    pub fn db_difficulty(self) -> Option<&'static str> {
        match self {
            Self::Easy => Some("easy"),
            Self::Medium => Some("medium"),
            Self::Hard => Some("hard"),
            Self::Expert => None,
        }
    }
}

/// Map optional difficulty string for session uniqueness (TS save-result).
///
/// # Errors
///
/// Returns an error string when the difficulty label is unknown.
pub fn map_session_difficulty(raw: Option<&str>) -> Result<Option<&'static str>, String> {
    match raw {
        None => Ok(None),
        Some(s) => {
            let d = RouteDifficulty::parse(s)
                .ok_or_else(|| format!("invalid difficulty: {s}"))?;
            Ok(d.db_difficulty())
        }
    }
}

/// Failures for save-result preflight (before scoring / DB write).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SaveResultError {
    InvalidGameSlug,
    InvalidMode,
    InvalidStatus,
    AbandonedNotValidatable,
    MissingArchiveDate,
    InvalidArchiveDate,
    InvalidDifficulty,
    AlreadyPlayed,
}

impl SaveResultError {
    #[must_use]
    pub fn message(&self) -> &'static str {
        match self {
            Self::InvalidGameSlug => "Game not found",
            Self::InvalidMode => "Invalid mode",
            Self::InvalidStatus => "Invalid status",
            Self::AbandonedNotValidatable => "Cannot validate abandoned game",
            Self::MissingArchiveDate => "archiveDate required for archive mode",
            Self::InvalidArchiveDate => "Invalid archiveDate",
            Self::InvalidDifficulty => "Invalid difficulty",
            Self::AlreadyPlayed => "Already played",
        }
    }

    #[must_use]
    pub fn status(&self) -> StatusCode {
        match self {
            Self::InvalidGameSlug => StatusCode::NOT_FOUND,
            Self::AlreadyPlayed => StatusCode::CONFLICT,
            _ => StatusCode::BAD_REQUEST,
        }
    }
}

/// Normalized save-result preflight (pure; no DB).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResultPlan {
    pub game_slug: String,
    pub mode: GameMode,
    pub status: ClaimedStatus,
    pub attempts: u32,
    pub time_spent_ms: u64,
    pub puzzle_id: String,
    pub puzzle_date: String,
    pub archive_date: Option<String>,
    pub difficulty: Option<String>,
}

/// Input bundle for [`plan_save_result`] (avoids too-many-arguments).
#[derive(Debug, Clone)]
pub struct SaveResultInput<'a> {
    pub game_slug: &'a str,
    pub status: &'a str,
    pub attempts: u32,
    pub time_spent_ms: u64,
    pub mode: Option<&'a str>,
    pub archive_date: Option<&'a str>,
    pub puzzle_id: &'a str,
    pub difficulty: Option<&'a str>,
    pub today: NaiveDate,
    pub already_played: bool,
}

/// Plan a save-result write after request parsing (parity preflight).
///
/// `already_played` is supplied by the caller (session store / DB lookup).
///
/// # Errors
///
/// Returns [`SaveResultError`] for invalid inputs or duplicate play.
pub fn plan_save_result(input: &SaveResultInput<'_>) -> Result<SaveResultPlan, SaveResultError> {
    if !is_valid_game_slug(input.game_slug) {
        return Err(SaveResultError::InvalidGameSlug);
    }
    let mode = GameMode::parse(input.mode.unwrap_or("daily")).ok_or(SaveResultError::InvalidMode)?;
    let status = ClaimedStatus::parse(input.status).ok_or(SaveResultError::InvalidStatus)?;
    if !status.is_validatable() {
        return Err(SaveResultError::AbandonedNotValidatable);
    }
    if input.puzzle_id.trim().is_empty() {
        return Err(SaveResultError::InvalidStatus);
    }
    let difficulty = map_session_difficulty(input.difficulty)
        .map_err(|_| SaveResultError::InvalidDifficulty)?
        .map(str::to_string);

    let (puzzle_date, archive_date) = match mode {
        GameMode::Archive => {
            let raw = input
                .archive_date
                .ok_or(SaveResultError::MissingArchiveDate)?;
            let d = parse_date_yyyy_mm_dd(raw).map_err(|_| SaveResultError::InvalidArchiveDate)?;
            if !is_valid_archive_date(d, input.today) {
                return Err(SaveResultError::InvalidArchiveDate);
            }
            let s = puzzle_date_string_utc(d);
            (s.clone(), Some(s))
        }
        GameMode::Daily | GameMode::Practice => (puzzle_date_string_utc(input.today), None),
    };

    if input.already_played && matches!(mode, GameMode::Daily | GameMode::Archive) {
        return Err(SaveResultError::AlreadyPlayed);
    }

    Ok(SaveResultPlan {
        game_slug: input.game_slug.to_string(),
        mode,
        status,
        attempts: input.attempts,
        time_spent_ms: input.time_spent_ms,
        puzzle_id: input.puzzle_id.to_string(),
        puzzle_date,
        archive_date,
        difficulty,
    })
}

/// Daily-status response envelope (puzzle materialization residual when null).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStatusResponse {
    pub has_completed: bool,
    pub completed_session: Option<Value>,
    pub puzzle: DailyPuzzleMeta,
    pub can_play: bool,
    pub mode: &'static str,
    pub slice: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPuzzleMeta {
    pub id: Option<String>,
    pub puzzle_number: u32,
    pub puzzle_date: String,
    pub puzzle_data: Option<Value>,
    pub difficulty: Option<String>,
}

/// Build daily-status envelope (pure).
///
/// # Errors
///
/// Returns [`StatusCode::NOT_FOUND`] / [`StatusCode::BAD_REQUEST`] for invalid inputs.
pub fn build_daily_status(
    game_slug: &str,
    today: NaiveDate,
    difficulty: Option<&str>,
    completed_session: Option<Value>,
    puzzle_id: Option<String>,
    puzzle_data: Option<Value>,
) -> Result<DailyStatusResponse, StatusCode> {
    if !is_valid_game_slug(game_slug) {
        return Err(StatusCode::NOT_FOUND);
    }
    if let Some(d) = difficulty {
        if RouteDifficulty::parse(d).is_none() {
            return Err(StatusCode::BAD_REQUEST);
        }
    }
    let has_completed = completed_session.is_some();
    Ok(DailyStatusResponse {
        has_completed,
        completed_session,
        puzzle: DailyPuzzleMeta {
            id: puzzle_id,
            puzzle_number: get_puzzle_number(today, None),
            puzzle_date: puzzle_date_string_utc(today),
            puzzle_data,
            difficulty: difficulty.map(str::to_string),
        },
        can_play: !has_completed,
        mode: "daily",
        slice: "api-v1-hono-monolith",
    })
}

/// Archive access policy (premium + past date).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ArchiveAccessError {
    NotPremium,
    UnknownGame,
    InvalidDate,
    FutureOrToday,
    AlreadyPlayed,
}

impl ArchiveAccessError {
    #[must_use]
    pub fn message(&self) -> &'static str {
        match self {
            Self::NotPremium => "Archive access requires premium subscription",
            Self::UnknownGame => "Unknown game",
            Self::InvalidDate => "Invalid date",
            Self::FutureOrToday => "Cannot access future puzzles",
            Self::AlreadyPlayed => "Already played this archive puzzle",
        }
    }

    #[must_use]
    pub fn status(&self) -> StatusCode {
        match self {
            Self::NotPremium => StatusCode::FORBIDDEN,
            Self::UnknownGame => StatusCode::NOT_FOUND,
            Self::AlreadyPlayed => StatusCode::CONFLICT,
            _ => StatusCode::BAD_REQUEST,
        }
    }
}

/// Validate archive-puzzle access (pure).
///
/// # Errors
///
/// Returns [`ArchiveAccessError`] when policy rejects the request.
pub fn check_archive_access(
    game_slug: &str,
    date: &str,
    today: NaiveDate,
    is_premium: bool,
    already_played: bool,
) -> Result<NaiveDate, ArchiveAccessError> {
    if !is_premium {
        return Err(ArchiveAccessError::NotPremium);
    }
    if !is_valid_game_slug(game_slug) {
        return Err(ArchiveAccessError::UnknownGame);
    }
    let d = parse_date_yyyy_mm_dd(date).map_err(|_| ArchiveAccessError::InvalidDate)?;
    if !is_valid_archive_date(d, today) {
        return Err(ArchiveAccessError::FutureOrToday);
    }
    if already_played {
        return Err(ArchiveAccessError::AlreadyPlayed);
    }
    Ok(d)
}

/// Build archive-dates calendar with played flags (pure).
#[must_use]
pub fn build_archive_dates(
    start: NaiveDate,
    end: NaiveDate,
    today: NaiveDate,
    played: &[NaiveDate],
) -> Vec<ArchiveDateEntry> {
    expand_archive_dates(start, end, today)
        .into_iter()
        .map(|d| ArchiveDateEntry {
            date: puzzle_date_string_utc(d),
            played: played.contains(&d),
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveDateEntry {
    pub date: String,
    pub played: bool,
}

// ---------------------------------------------------------------------------
// HTTP handlers (product dens surface)
// ---------------------------------------------------------------------------

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
    let Some(slug) = q.game_slug.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid query parameters", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    };
    let today = get_today_utc();
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
        Err(StatusCode::NOT_FOUND) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Unknown game: {slug}"), "slice": "api-v1-hono-monolith" })),
        )
            .into_response(),
        Err(code) => (
            code,
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
    let Some(slug) = q.game_slug.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
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
    let today = get_today_utc();
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

/// POST /api/v1/games/archive-access — product policy dens (premium + past).
pub async fn archive_access_http(Json(body): Json<ArchiveAccessBody>) -> Response {
    let today = get_today_utc();
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
            err.status(),
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

/// POST /api/v1/games/save-result — plan + optional score envelope.
pub async fn save_result_http(Json(body): Json<SaveResultBody>) -> Response {
    let today = get_today_utc();
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
        Ok(plan) => (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "plan": plan,
                "mode": plan.mode.as_str(),
                "score": body.score,
                "usedFreeze": body.used_freeze.unwrap_or(false),
                "session": null,
                "stub": true,
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response(),
        Err(err) => (
            err.status(),
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
    let Some(slug) = q.game_slug.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
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
    let today = get_today_utc();
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
    let games: Vec<Value> = crate::game_slugs::all_game_slugs()
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
    let Some(slug) = q.game_slug.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
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
        let err =
            plan_save_result(&save_input("sudoku", "won", None, true)).expect_err("dup");
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
            Err(StatusCode::NOT_FOUND)
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
