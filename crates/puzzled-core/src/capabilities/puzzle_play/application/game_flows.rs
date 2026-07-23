//! Pure puzzle-play application flows (daily status, archive access, save planning).
//!
//! Clock and HTTP stay in the shell; these functions take explicit dates and inputs.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::capabilities::puzzle_play::daily_time::{
    expand_archive_dates, get_puzzle_number, is_valid_archive_date, parse_date_yyyy_mm_dd,
    puzzle_date_string_utc,
};
use crate::capabilities::puzzle_play::game_slugs::is_valid_game_slug;

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
            let d = RouteDifficulty::parse(s).ok_or_else(|| format!("invalid difficulty: {s}"))?;
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
    pub fn status_code(&self) -> u16 {
        match self {
            Self::InvalidGameSlug => 404,
            Self::AlreadyPlayed => 409,
            _ => 400,
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
    let mode =
        GameMode::parse(input.mode.unwrap_or("daily")).ok_or(SaveResultError::InvalidMode)?;
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
/// Returns HTTP-like status codes 404/400 for invalid inputs (shell maps to status_code).
pub fn build_daily_status(
    game_slug: &str,
    today: NaiveDate,
    difficulty: Option<&str>,
    completed_session: Option<Value>,
    puzzle_id: Option<String>,
    puzzle_data: Option<Value>,
) -> Result<DailyStatusResponse, u16> {
    if !is_valid_game_slug(game_slug) {
        return Err(404);
    }
    if let Some(d) = difficulty {
        if RouteDifficulty::parse(d).is_none() {
            return Err(400);
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
    pub fn status_code(&self) -> u16 {
        match self {
            Self::NotPremium => 403,
            Self::UnknownGame => 404,
            Self::AlreadyPlayed => 409,
            _ => 400,
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
// HTTP handlers (product residual surface)
// ---------------------------------------------------------------------------
