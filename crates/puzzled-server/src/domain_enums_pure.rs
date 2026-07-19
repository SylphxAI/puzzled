//! Pure domain enum catalogs —
//! dual-oracle residual of `apps/puzzled/src/lib/db/schema.ts` business enums
//! (`game_status`, `game_mode`, difficulty, DLQ, audit, announcement, win-back).
//! Drizzle/Postgres I/O stays FE-TS residual. NO authority_rust / ts_deleted.

/// TS `gameStatusEnum` / `GAME_STATUS_VALUES`.
pub const GAME_STATUS_VALUES: &[&str] = &["in_progress", "won", "lost", "abandoned"];

/// TS `GAME_RESULT_STATUSES` (won/lost only).
pub const GAME_RESULT_STATUSES: &[&str] = &["won", "lost"];

/// TS `gameModeEnum` / `GAME_MODE_VALUES`.
pub const GAME_MODE_VALUES: &[&str] = &["daily", "archive"];

/// TS `puzzleDifficultyEnum` / `PUZZLE_DIFFICULTY_VALUES`.
pub const PUZZLE_DIFFICULTY_VALUES: &[&str] = &["easy", "medium", "hard"];

/// TS `winBackEmailTypeEnum`.
pub const WIN_BACK_EMAIL_TYPES: &[&str] = &["day7", "day14", "day30"];

/// TS `dlqStatusEnum` / `DLQ_STATUS_VALUES`.
pub const DLQ_STATUS_VALUES: &[&str] = &["pending", "retrying", "resolved", "failed"];

/// TS `auditActionEnum`.
pub const AUDIT_ACTION_VALUES: &[&str] = &[
    "create",
    "update",
    "delete",
    "game_complete",
    "streak_update",
    "achievement_unlock",
    "admin_action",
];

/// TS `announcementTypeEnum`.
pub const ANNOUNCEMENT_TYPE_VALUES: &[&str] = &["info", "warning", "success", "maintenance"];

/// TS `AppSettingKey` union.
pub const APP_SETTING_KEYS: &[&str] = &[
    "puzzle_generator_model",
    "maintenance_mode",
    "daily_puzzle_time",
];

#[must_use]
pub fn is_game_status(v: &str) -> bool {
    GAME_STATUS_VALUES.contains(&v)
}

#[must_use]
pub fn is_game_result_status(v: &str) -> bool {
    GAME_RESULT_STATUSES.contains(&v)
}

#[must_use]
pub fn is_game_mode(v: &str) -> bool {
    GAME_MODE_VALUES.contains(&v)
}

#[must_use]
pub fn is_puzzle_difficulty(v: &str) -> bool {
    PUZZLE_DIFFICULTY_VALUES.contains(&v)
}

#[must_use]
pub fn is_win_back_email_type(v: &str) -> bool {
    WIN_BACK_EMAIL_TYPES.contains(&v)
}

#[must_use]
pub fn is_dlq_status(v: &str) -> bool {
    DLQ_STATUS_VALUES.contains(&v)
}

#[must_use]
pub fn is_audit_action(v: &str) -> bool {
    AUDIT_ACTION_VALUES.contains(&v)
}

#[must_use]
pub fn is_announcement_type(v: &str) -> bool {
    ANNOUNCEMENT_TYPE_VALUES.contains(&v)
}

#[must_use]
pub fn is_app_setting_key(v: &str) -> bool {
    APP_SETTING_KEYS.contains(&v)
}

/// Terminal DLQ statuses that stop retry (resolved/failed).
#[must_use]
pub fn is_dlq_terminal(status: &str) -> bool {
    matches!(status, "resolved" | "failed")
}

/// Active game session statuses (in_progress only).
#[must_use]
pub fn is_session_active(status: &str) -> bool {
    status == "in_progress"
}

/// Win-back day offset from type wire (`day7` → 7).
#[must_use]
pub fn win_back_day_offset(email_type: &str) -> Option<u32> {
    match email_type {
        "day7" => Some(7),
        "day14" => Some(14),
        "day30" => Some(30),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enum_catalogs_dual_oracle() {
        assert_eq!(
            GAME_STATUS_VALUES,
            &["in_progress", "won", "lost", "abandoned"]
        );
        assert_eq!(GAME_RESULT_STATUSES, &["won", "lost"]);
        assert_eq!(GAME_MODE_VALUES, &["daily", "archive"]);
        assert_eq!(PUZZLE_DIFFICULTY_VALUES, &["easy", "medium", "hard"]);
        assert_eq!(WIN_BACK_EMAIL_TYPES, &["day7", "day14", "day30"]);
        assert_eq!(
            DLQ_STATUS_VALUES,
            &["pending", "retrying", "resolved", "failed"]
        );
        assert_eq!(AUDIT_ACTION_VALUES.len(), 7);
        assert_eq!(ANNOUNCEMENT_TYPE_VALUES.len(), 4);
        assert_eq!(APP_SETTING_KEYS.len(), 3);

        assert!(is_game_status("won"));
        assert!(!is_game_status("tie"));
        assert!(is_game_result_status("lost"));
        assert!(!is_game_result_status("abandoned"));
        assert!(is_game_mode("archive"));
        assert!(is_puzzle_difficulty("hard"));
        assert!(is_win_back_email_type("day14"));
        assert!(is_dlq_status("retrying"));
        assert!(is_audit_action("achievement_unlock"));
        assert!(is_announcement_type("maintenance"));
        assert!(is_app_setting_key("maintenance_mode"));
        assert!(is_dlq_terminal("resolved"));
        assert!(!is_dlq_terminal("pending"));
        assert!(is_session_active("in_progress"));
        assert_eq!(win_back_day_offset("day7"), Some(7));
        assert_eq!(win_back_day_offset("day30"), Some(30));
        assert_eq!(win_back_day_offset("day1"), None);
    }
}

// ── wave65 pure residual dens: domain enum catalog dual-oracle residual ──
// Dual-oracle residual of schema.ts business enum pure halves.
// Clock / DB I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: game status catalog size is 4.
#[must_use]
pub fn game_status_count() -> usize {
    GAME_STATUS_VALUES.len()
}

/// Dual-oracle residual: game mode catalog size is 2.
#[must_use]
pub fn game_mode_count() -> usize {
    GAME_MODE_VALUES.len()
}

/// Dual-oracle residual: difficulty catalog size is 3.
#[must_use]
pub fn puzzle_difficulty_count() -> usize {
    PUZZLE_DIFFICULTY_VALUES.len()
}

/// Dual-oracle residual: DLQ status catalog size is 4.
#[must_use]
pub fn dlq_status_count() -> usize {
    DLQ_STATUS_VALUES.len()
}

/// Dual-oracle residual: result statuses are subset of game statuses.
#[must_use]
pub fn game_result_subset_of_status() -> bool {
    GAME_RESULT_STATUSES.iter().all(|s| is_game_status(s))
}

/// Dual-oracle residual: win-back email day ladder.
#[must_use]
pub fn win_back_email_day_ladder() -> [&'static str; 3] {
    [
        WIN_BACK_EMAIL_TYPES[0],
        WIN_BACK_EMAIL_TYPES[1],
        WIN_BACK_EMAIL_TYPES[2],
    ]
}

#[cfg(test)]
mod wave65_tests {
    use super::*;

    #[test]
    fn wave65_domain_enum_catalog_dual_oracle() {
        assert_eq!(game_status_count(), 4);
        assert_eq!(game_mode_count(), 2);
        assert_eq!(puzzle_difficulty_count(), 3);
        assert_eq!(dlq_status_count(), 4);
        assert!(game_result_subset_of_status());
        assert_eq!(win_back_email_day_ladder(), ["day7", "day14", "day30"]);
        assert!(is_game_status("in_progress"));
        assert!(is_game_mode("daily"));
        assert!(is_puzzle_difficulty("hard"));
        assert!(is_dlq_status("retrying"));
        assert!(is_dlq_terminal("resolved"));
        assert!(!is_dlq_terminal("pending"));
        assert!(is_audit_action("game_complete"));
        assert!(is_announcement_type("maintenance"));
        assert!(is_app_setting_key("maintenance_mode"));
        assert!(!is_game_status("queued"));
    }
}
