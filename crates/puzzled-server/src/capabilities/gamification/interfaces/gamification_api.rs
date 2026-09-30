//! Gamification HTTP interfaces (ADR-169).

use serde::{Deserialize, Serialize};

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
            // Earned freezes cover missed days until the player turns it off.
            auto_freeze_enabled: true,
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

/// Why a personal streak payload cannot be returned.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreakReadError {
    StoreUnavailable,
    ReadFailed,
}

/// Missing session store cannot be reported as a zero streak.
pub fn require_streak_store<T>(store: Option<T>) -> Result<T, StreakReadError> {
    store.ok_or(StreakReadError::StoreUnavailable)
}

/// Streak-info envelope derived from accepted ritual days plus freeze residual.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakInfo {
    pub current_streak: i32,
    pub max_streak: i32,
    pub has_played_today: bool,
    pub total_games_played: i32,
    pub freezes_available: i32,
    pub auto_freeze_enabled: bool,
    pub days_until_next_freeze: i32,
    pub freeze_used_yesterday: bool,
}

fn u32_to_i32(value: u32) -> i32 {
    i32::try_from(value).unwrap_or(i32::MAX)
}

/// Build streak-info response from an already computed personal streak.
#[must_use]
pub fn build_streak_info(
    streak: puzzled_core::gamification::personal_streak::PersonalStreak,
    total_games_played: i32,
    freeze: &FreezeData,
) -> StreakInfo {
    StreakInfo {
        current_streak: u32_to_i32(streak.current_streak),
        max_streak: u32_to_i32(streak.max_streak),
        has_played_today: streak.has_played_today,
        total_games_played,
        freezes_available: freeze.freezes_available,
        auto_freeze_enabled: freeze.auto_freeze_enabled,
        days_until_next_freeze: u32_to_i32(streak.days_until_next_freeze),
        freeze_used_yesterday: streak.freeze_used_yesterday,
    }
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
    fn streak_info_uses_computed_personal_streak() {
        use chrono::NaiveDate;
        use puzzled_core::gamification::personal_streak::compute_personal_streak;

        let freeze = FreezeData {
            user_id: "u".into(),
            freezes_available: 1,
            freezes_used: 0,
            auto_freeze_enabled: true,
        };
        let today = NaiveDate::from_ymd_opt(2026, 8, 22).expect("day");
        let days = [
            NaiveDate::from_ymd_opt(2026, 8, 20).expect("d"),
            NaiveDate::from_ymd_opt(2026, 8, 21).expect("d"),
            NaiveDate::from_ymd_opt(2026, 8, 22).expect("d"),
        ];
        let streak = compute_personal_streak(today, &days, &[]);
        let info = build_streak_info(streak, 42, &freeze);
        assert_eq!(info.current_streak, 3);
        assert_eq!(info.max_streak, 3);
        assert!(info.has_played_today);
        assert_eq!(info.total_games_played, 42);
        assert_eq!(info.freezes_available, 1);
        assert!(info.auto_freeze_enabled);
        assert_eq!(info.days_until_next_freeze, 4);
        assert!(!info.freeze_used_yesterday);
    }

    #[test]
    fn a_new_player_covers_missed_days_automatically() {
        assert!(FreezeData::new("u1").auto_freeze_enabled);
    }

    #[test]
    fn a_missing_store_fails_closed_not_as_a_zero_streak() {
        assert_eq!(
            require_streak_store::<()>(None),
            Err(StreakReadError::StoreUnavailable)
        );
        assert_eq!(require_streak_store(Some(1)), Ok(1));
    }
}
