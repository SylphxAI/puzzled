//! Hono gamification domain product dens (`api-v1-hono-monolith` /gamification/*).
//!
//! Ports freeze toggle/add policy + streak-info envelope from
//! `apps/puzzled/src/server/api/routes/gamification.ts`.
//! Platform SDK streak values remain client residual (server returns 0).

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Freeze reason labels (parity: AddStreakFreezesBodySchema).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FreezeReason {
    Referral,
    Purchase,
    Promotion,
    Manual,
    PremiumPerk,
}

impl FreezeReason {
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "referral" => Some(Self::Referral),
            "purchase" => Some(Self::Purchase),
            "promotion" => Some(Self::Promotion),
            "manual" => Some(Self::Manual),
            "premium_perk" => Some(Self::PremiumPerk),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Referral => "referral",
            Self::Purchase => "purchase",
            Self::Promotion => "promotion",
            Self::Manual => "manual",
            Self::PremiumPerk => "premium_perk",
        }
    }
}

/// In-memory freeze record (sqlx dual-path residual).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FreezeData {
    pub user_id: String,
    pub freezes_available: i32,
    pub freezes_used: i32,
    pub auto_freeze_enabled: bool,
}

impl FreezeData {
    #[must_use]
    pub fn new(user_id: impl Into<String>) -> Self {
        Self {
            user_id: user_id.into(),
            freezes_available: 0,
            freezes_used: 0,
            auto_freeze_enabled: false,
        }
    }
}

/// Toggle auto-freeze (pure state transition).
#[must_use]
pub fn toggle_auto_freeze(mut data: FreezeData, enabled: bool) -> FreezeData {
    data.auto_freeze_enabled = enabled;
    data
}

/// Errors for add-streak-freezes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AddFreezeError {
    InvalidCount,
    InvalidReason,
    EmptyUserId,
}

impl AddFreezeError {
    #[must_use]
    pub fn message(&self) -> &'static str {
        match self {
            Self::InvalidCount => "count must be 1..=10",
            Self::InvalidReason => "invalid reason",
            Self::EmptyUserId => "userId required",
        }
    }

    #[must_use]
    pub fn status(&self) -> StatusCode {
        StatusCode::BAD_REQUEST
    }
}

/// Add freezes (parity: count 1..=10).
///
/// # Errors
///
/// Returns [`AddFreezeError`] for invalid inputs.
pub fn add_streak_freezes(
    mut data: FreezeData,
    count: i32,
    reason: &str,
) -> Result<(FreezeData, FreezeReason), AddFreezeError> {
    if data.user_id.trim().is_empty() {
        return Err(AddFreezeError::EmptyUserId);
    }
    if !(1..=10).contains(&count) {
        return Err(AddFreezeError::InvalidCount);
    }
    let reason = FreezeReason::parse(reason).ok_or(AddFreezeError::InvalidReason)?;
    data.freezes_available = data.freezes_available.saturating_add(count);
    Ok((data, reason))
}

/// Try auto-freeze on loss (premium + available freezes).
///
/// Returns `(used, updated_data)`.
#[must_use]
pub fn try_auto_freeze(mut data: FreezeData, is_premium: bool) -> (bool, FreezeData) {
    if !is_premium || !data.auto_freeze_enabled || data.freezes_available <= 0 {
        return (false, data);
    }
    data.freezes_available -= 1;
    data.freezes_used = data.freezes_used.saturating_add(1);
    (true, data)
}

/// Streak-info envelope (Platform streak residual = 0).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakInfo {
    pub current_streak: i32,
    pub max_streak: i32,
    pub has_played_today: bool,
    pub total_games_played: i32,
    pub freezes_available: i32,
    pub auto_freeze_enabled: bool,
}

/// Build streak-info response (pure).
#[must_use]
pub fn build_streak_info(
    has_played_today: bool,
    total_games_played: i32,
    freeze: &FreezeData,
) -> StreakInfo {
    StreakInfo {
        current_streak: 0,
        max_streak: 0,
        has_played_today,
        total_games_played,
        freezes_available: freeze.freezes_available,
        auto_freeze_enabled: freeze.auto_freeze_enabled,
    }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakInfoBody {
    pub user_id: Option<String>,
    pub has_played_today: Option<bool>,
    pub total_games_played: Option<i32>,
    pub freezes_available: Option<i32>,
    pub auto_freeze_enabled: Option<bool>,
}

/// POST /api/v1/gamification/streak-info — shape dens (DB residual).
pub async fn streak_info_http(Json(body): Json<StreakInfoBody>) -> Response {
    let freeze = FreezeData {
        user_id: body.user_id.unwrap_or_default(),
        freezes_available: body.freezes_available.unwrap_or(0),
        freezes_used: 0,
        auto_freeze_enabled: body.auto_freeze_enabled.unwrap_or(false),
    };
    let info = build_streak_info(
        body.has_played_today.unwrap_or(false),
        body.total_games_played.unwrap_or(0),
        &freeze,
    );
    (
        StatusCode::OK,
        Json(json!({
            "info": info,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleAutoFreezeBody {
    pub user_id: String,
    pub enabled: bool,
    pub freezes_available: Option<i32>,
    pub freezes_used: Option<i32>,
}

/// POST /api/v1/gamification/toggle-auto-freeze
pub async fn toggle_auto_freeze_http(Json(body): Json<ToggleAutoFreezeBody>) -> Response {
    if body.user_id.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "userId required", "slice": "api-v1-hono-monolith" })),
        )
            .into_response();
    }
    let data = FreezeData {
        user_id: body.user_id,
        freezes_available: body.freezes_available.unwrap_or(0),
        freezes_used: body.freezes_used.unwrap_or(0),
        auto_freeze_enabled: false,
    };
    let updated = toggle_auto_freeze(data, body.enabled);
    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "autoFreezeEnabled": updated.auto_freeze_enabled,
            "freeze": updated,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddStreakFreezesBody {
    pub user_id: String,
    pub count: i32,
    pub reason: String,
    pub freezes_available: Option<i32>,
}

/// POST /api/v1/gamification/add-streak-freezes
pub async fn add_streak_freezes_http(Json(body): Json<AddStreakFreezesBody>) -> Response {
    let data = FreezeData {
        user_id: body.user_id,
        freezes_available: body.freezes_available.unwrap_or(0),
        freezes_used: 0,
        auto_freeze_enabled: false,
    };
    match add_streak_freezes(data, body.count, &body.reason) {
        Ok((updated, reason)) => (
            StatusCode::OK,
            Json(json!({
                "success": true,
                "freezesAvailable": updated.freezes_available,
                "reason": reason.as_str(),
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
pub struct TryAutoFreezeBody {
    pub user_id: String,
    pub is_premium: bool,
    pub freezes_available: Option<i32>,
    pub freezes_used: Option<i32>,
    pub auto_freeze_enabled: Option<bool>,
}

/// POST /api/v1/gamification/try-auto-freeze — loss path dens.
pub async fn try_auto_freeze_http(Json(body): Json<TryAutoFreezeBody>) -> Response {
    let data = FreezeData {
        user_id: body.user_id,
        freezes_available: body.freezes_available.unwrap_or(0),
        freezes_used: body.freezes_used.unwrap_or(0),
        auto_freeze_enabled: body.auto_freeze_enabled.unwrap_or(false),
    };
    let (used, updated) = try_auto_freeze(data, body.is_premium);
    (
        StatusCode::OK,
        Json(json!({
            "usedFreeze": used,
            "freeze": updated,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toggle_sets_flag() {
        let d = FreezeData::new("u1");
        let d = toggle_auto_freeze(d, true);
        assert!(d.auto_freeze_enabled);
    }

    #[test]
    fn add_freezes_bounds() {
        let d = FreezeData::new("u1");
        assert!(add_streak_freezes(d.clone(), 0, "manual").is_err());
        assert!(add_streak_freezes(d.clone(), 11, "manual").is_err());
        let (d, r) = add_streak_freezes(d, 3, "referral").expect("ok");
        assert_eq!(d.freezes_available, 3);
        assert_eq!(r, FreezeReason::Referral);
    }

    #[test]
    fn auto_freeze_consumes() {
        let mut d = FreezeData::new("u1");
        d.freezes_available = 2;
        d.auto_freeze_enabled = true;
        let (used, d) = try_auto_freeze(d, true);
        assert!(used);
        assert_eq!(d.freezes_available, 1);
        assert_eq!(d.freezes_used, 1);
    }

    #[test]
    fn auto_freeze_requires_premium() {
        let mut d = FreezeData::new("u1");
        d.freezes_available = 2;
        d.auto_freeze_enabled = true;
        let (used, d) = try_auto_freeze(d, false);
        assert!(!used);
        assert_eq!(d.freezes_available, 2);
    }

    #[test]
    fn streak_info_platform_placeholder() {
        let d = FreezeData {
            user_id: "u".into(),
            freezes_available: 1,
            freezes_used: 0,
            auto_freeze_enabled: true,
        };
        let info = build_streak_info(true, 42, &d);
        assert_eq!(info.current_streak, 0);
        assert_eq!(info.max_streak, 0);
        assert!(info.has_played_today);
        assert_eq!(info.total_games_played, 42);
    }
}
