//! Hono user + notifications preferences product dens
//! (`api-v1-hono-monolith` /user/* + /notifications/*).
//!
//! Ports validation kernels from
//! `apps/puzzled/src/server/api/routes/user.ts` and
//! `apps/puzzled/src/server/api/routes/notifications.ts`.
//! DB upsert + Platform profile fields remain dual-path residual.

use axum::extract::Query;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Parity: `USER_LIMITS` in `apps/puzzled/src/lib/config/user.ts`
/// (SSOT densed in `user_profile_limits_pure`).
pub use crate::user_profile_limits_pure::{
    BIO_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH,
};

/// Username validation (lowercase letters, digits, underscore).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UsernameError {
    TooShort,
    TooLong,
    InvalidChars,
}

impl UsernameError {
    #[must_use]
    pub fn message(&self) -> String {
        match self {
            Self::TooShort => format!("Username must be at least {USERNAME_MIN_LENGTH} characters"),
            Self::TooLong => format!("Username must be at most {USERNAME_MAX_LENGTH} characters"),
            Self::InvalidChars => {
                "Username can only contain lowercase letters, numbers, and underscores".to_string()
            }
        }
    }
}

/// Validate username shape (parity: usernameSchema).
///
/// # Errors
///
/// Returns [`UsernameError`] when constraints fail.
pub fn validate_username(username: &str) -> Result<(), UsernameError> {
    let len = username.chars().count();
    if len < USERNAME_MIN_LENGTH {
        return Err(UsernameError::TooShort);
    }
    if len > USERNAME_MAX_LENGTH {
        return Err(UsernameError::TooLong);
    }
    if !username
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(UsernameError::InvalidChars);
    }
    Ok(())
}

/// Validate optional bio.
///
/// # Errors
///
/// Returns error string when too long.
pub fn validate_bio(bio: Option<&str>) -> Result<(), String> {
    if let Some(b) = bio {
        if b.chars().count() > BIO_MAX_LENGTH {
            return Err(format!("Bio must be at most {BIO_MAX_LENGTH} characters"));
        }
    }
    Ok(())
}

/// Username availability (parity: check-username).
#[must_use]
pub fn username_available(
    username: &str,
    existing_owner: Option<&str>,
    current_user_id: &str,
) -> bool {
    match existing_owner {
        None => true,
        Some(owner) => owner == current_user_id || username.is_empty(),
    }
}

/// HH:mm time for daily reminder (parity: dailyReminderTime regex).
#[must_use]
pub fn is_valid_reminder_time(raw: &str) -> bool {
    let parts: Vec<&str> = raw.split(':').collect();
    if parts.len() != 2 {
        return false;
    }
    let Ok(h) = parts[0].parse::<u32>() else {
        return false;
    };
    let Ok(m) = parts[1].parse::<u32>() else {
        return false;
    };
    // Allow 0-9 or 00-23 for hour; minutes 00-59. TS: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    let hour_ok = h <= 23;
    let hour_str_ok =
        matches!(parts[0].len(), 1 | 2) && parts[0].chars().all(|c| c.is_ascii_digit());
    let min_ok = m <= 59 && parts[1].len() == 2 && parts[1].chars().all(|c| c.is_ascii_digit());
    hour_ok && hour_str_ok && min_ok
}

/// Profile prefs patch (pure merge).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePrefs {
    pub user_id: String,
    pub username: Option<String>,
    pub bio: Option<String>,
    pub is_public_profile: bool,
    pub compact_mode: bool,
    pub leaderboard_visible: bool,
}

/// Apply profile update fields with validation.
///
/// # Errors
///
/// Returns error message on invalid username/bio.
pub fn apply_profile_update(
    mut prefs: ProfilePrefs,
    username: Option<&str>,
    bio: Option<&str>,
    is_public_profile: Option<bool>,
) -> Result<ProfilePrefs, String> {
    if let Some(u) = username {
        validate_username(u).map_err(|e| e.message())?;
        prefs.username = Some(u.to_string());
    }
    if bio.is_some() {
        validate_bio(bio)?;
        prefs.bio = bio.map(str::to_string);
    }
    if let Some(p) = is_public_profile {
        prefs.is_public_profile = p;
    }
    Ok(prefs)
}

/// Apply compact/leaderboard preference patch.
#[must_use]
pub fn apply_ui_preferences(
    mut prefs: ProfilePrefs,
    compact_mode: Option<bool>,
    leaderboard_visible: Option<bool>,
) -> ProfilePrefs {
    if let Some(c) = compact_mode {
        prefs.compact_mode = c;
    }
    if let Some(l) = leaderboard_visible {
        prefs.leaderboard_visible = l;
    }
    prefs
}

/// Notification preferences (parity defaults).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPrefs {
    pub user_id: String,
    pub push_enabled: bool,
    pub push_daily_reminder: bool,
    pub push_streak_alert: bool,
    pub push_new_games: bool,
    pub daily_reminder_time: Option<String>,
    pub email_enabled: bool,
    pub email_weekly_digest: bool,
    pub email_marketing: bool,
}

impl NotificationPrefs {
    #[must_use]
    pub fn defaults(user_id: impl Into<String>) -> Self {
        Self {
            user_id: user_id.into(),
            push_enabled: true,
            push_daily_reminder: true,
            push_streak_alert: true,
            push_new_games: true,
            daily_reminder_time: None,
            email_enabled: true,
            email_weekly_digest: true,
            email_marketing: false,
        }
    }
}

/// Apply push preference patch.
///
/// # Errors
///
/// Returns error when `daily_reminder_time` is invalid.
pub fn apply_push_preferences(
    mut prefs: NotificationPrefs,
    push_enabled: Option<bool>,
    push_daily_reminder: Option<bool>,
    push_streak_alert: Option<bool>,
    push_new_games: Option<bool>,
    daily_reminder_time: Option<&str>,
) -> Result<NotificationPrefs, String> {
    if let Some(v) = push_enabled {
        prefs.push_enabled = v;
    }
    if let Some(v) = push_daily_reminder {
        prefs.push_daily_reminder = v;
    }
    if let Some(v) = push_streak_alert {
        prefs.push_streak_alert = v;
    }
    if let Some(v) = push_new_games {
        prefs.push_new_games = v;
    }
    if let Some(t) = daily_reminder_time {
        if !is_valid_reminder_time(t) {
            return Err("Invalid time format (HH:mm)".into());
        }
        prefs.daily_reminder_time = Some(t.to_string());
    }
    Ok(prefs)
}

/// Apply email preference patch.
#[must_use]
pub fn apply_email_preferences(
    mut prefs: NotificationPrefs,
    email_enabled: Option<bool>,
    email_weekly_digest: Option<bool>,
    email_marketing: Option<bool>,
) -> NotificationPrefs {
    if let Some(v) = email_enabled {
        prefs.email_enabled = v;
    }
    if let Some(v) = email_weekly_digest {
        prefs.email_weekly_digest = v;
    }
    if let Some(v) = email_marketing {
        prefs.email_marketing = v;
    }
    prefs
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckUsernameQuery {
    pub username: Option<String>,
    pub current_user_id: Option<String>,
    pub existing_owner: Option<String>,
}

/// GET /api/v1/user/check-username
pub async fn check_username_http(Query(q): Query<CheckUsernameQuery>) -> Response {
    let Some(username) = q.username.as_deref() else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid username", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    };
    if let Err(e) = validate_username(username) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e.message(), "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    let current = q.current_user_id.as_deref().unwrap_or("");
    let available = username_available(username, q.existing_owner.as_deref(), current);
    (
        StatusCode::OK,
        Json(json!({
            "available": available,
            "username": username,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileBody {
    pub user_id: String,
    pub username: Option<String>,
    pub bio: Option<String>,
    pub is_public_profile: Option<bool>,
    pub existing_owner: Option<String>,
}

/// PUT /api/v1/user/profile — validate + shape (DB residual).
pub async fn update_profile_http(Json(body): Json<UpdateProfileBody>) -> Response {
    if body.user_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "userId required", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    if let Some(ref u) = body.username {
        if let Some(ref owner) = body.existing_owner {
            if owner != &body.user_id {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({
                        "error": "Username is already taken",
                        "slice": "api-v1-hono-monolith",
                    })),
                )
                    .into_response();
            }
        }
        if let Err(e) = validate_username(u) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e.message(), "slice": "api-v1-hono-monolith" })),
            )
                .into_response();
        }
    }
    let base = ProfilePrefs {
        user_id: body.user_id,
        username: None,
        bio: None,
        is_public_profile: false,
        compact_mode: false,
        leaderboard_visible: true,
    };
    match apply_profile_update(
        base,
        body.username.as_deref(),
        body.bio.as_deref(),
        body.is_public_profile,
    ) {
        Ok(prefs) => (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "preferences": {
                    "userId": prefs.user_id,
                    "username": prefs.username,
                    "bio": prefs.bio,
                    "isPublicProfile": prefs.is_public_profile,
                },
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e, "slice": "api-v1-hono-monolith" })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUiPrefsBody {
    pub user_id: String,
    pub compact_mode: Option<bool>,
    pub leaderboard_visible: Option<bool>,
}

/// PUT /api/v1/user/preferences
pub async fn update_ui_preferences_http(Json(body): Json<UpdateUiPrefsBody>) -> Response {
    if body.user_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "userId required", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    let base = ProfilePrefs {
        user_id: body.user_id,
        username: None,
        bio: None,
        is_public_profile: false,
        compact_mode: false,
        leaderboard_visible: true,
    };
    let prefs = apply_ui_preferences(base, body.compact_mode, body.leaderboard_visible);
    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "preferences": {
                "compactMode": prefs.compact_mode,
                "leaderboardVisible": prefs.leaderboard_visible,
            },
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePushPrefsBody {
    pub user_id: String,
    pub push_enabled: Option<bool>,
    pub push_daily_reminder: Option<bool>,
    pub push_streak_alert: Option<bool>,
    pub push_new_games: Option<bool>,
    pub daily_reminder_time: Option<String>,
}

/// PUT /api/v1/notifications/push-preferences
pub async fn update_push_preferences_http(Json(body): Json<UpdatePushPrefsBody>) -> Response {
    if body.user_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "userId required", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    let base = NotificationPrefs::defaults(body.user_id);
    match apply_push_preferences(
        base,
        body.push_enabled,
        body.push_daily_reminder,
        body.push_streak_alert,
        body.push_new_games,
        body.daily_reminder_time.as_deref(),
    ) {
        Ok(prefs) => (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "preferences": prefs,
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e, "slice": "api-v1-hono-monolith" })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEmailPrefsBody {
    pub user_id: String,
    pub email_enabled: Option<bool>,
    pub email_weekly_digest: Option<bool>,
    pub email_marketing: Option<bool>,
}

/// PUT /api/v1/notifications/email-preferences
pub async fn update_email_preferences_http(Json(body): Json<UpdateEmailPrefsBody>) -> Response {
    if body.user_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "userId required", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    let base = NotificationPrefs::defaults(body.user_id);
    let prefs = apply_email_preferences(
        base,
        body.email_enabled,
        body.email_weekly_digest,
        body.email_marketing,
    );
    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "preferences": prefs,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn username_rules() {
        assert!(validate_username("ab").is_err());
        assert!(validate_username("abc").is_ok());
        assert!(validate_username("abc_12").is_ok());
        assert!(validate_username("ABC").is_err());
        assert!(validate_username("a-b").is_err());
        assert!(validate_username(&"a".repeat(21)).is_err());
    }

    #[test]
    fn bio_max() {
        assert!(validate_bio(Some(&"x".repeat(160))).is_ok());
        assert!(validate_bio(Some(&"x".repeat(161))).is_err());
    }

    #[test]
    fn username_availability() {
        assert!(username_available("ada", None, "u1"));
        assert!(username_available("ada", Some("u1"), "u1"));
        assert!(!username_available("ada", Some("u2"), "u1"));
    }

    #[test]
    fn reminder_time() {
        assert!(is_valid_reminder_time("09:30"));
        assert!(is_valid_reminder_time("9:30"));
        assert!(is_valid_reminder_time("23:59"));
        assert!(!is_valid_reminder_time("24:00"));
        assert!(!is_valid_reminder_time("9:3"));
        assert!(!is_valid_reminder_time("abc"));
    }

    #[test]
    fn push_prefs_reject_bad_time() {
        let p = NotificationPrefs::defaults("u");
        assert!(apply_push_preferences(p, None, None, None, None, Some("99:99")).is_err());
    }
}
