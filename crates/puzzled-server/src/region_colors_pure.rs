//! Pure queens region-color + API play-enum residual —
//! dual-oracle of `apps/puzzled/src/games/queens/types.ts` `REGION_COLORS`
//! and `apps/puzzled/src/server/api/schemas/common.ts` play-surface enums.
//!
//! Complements schema-layer `domain_enums_pure` (DB enums without practice/expert).
//! FE render / DB I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: queens region Tailwind color classes.
pub const REGION_COLORS: &[&str] = &[
    "bg-red-400/70 dark:bg-red-500/50",
    "bg-blue-400/70 dark:bg-blue-500/50",
    "bg-green-400/70 dark:bg-green-500/50",
    "bg-yellow-400/70 dark:bg-yellow-500/50",
    "bg-purple-400/70 dark:bg-purple-500/50",
    "bg-pink-400/70 dark:bg-pink-500/50",
    "bg-orange-400/70 dark:bg-orange-500/50",
    "bg-cyan-400/70 dark:bg-cyan-500/50",
    "bg-indigo-400/70 dark:bg-indigo-500/50",
];

/// Dual-oracle residual: API/common schema game modes (incl. practice).
pub const API_GAME_MODE_VALUES: &[&str] = &["daily", "archive", "practice"];

/// Dual-oracle residual: API/common schema puzzle difficulties (incl. expert).
pub const API_PUZZLE_DIFFICULTY_VALUES: &[&str] = &["easy", "medium", "hard", "expert"];

/// Dual-oracle residual: API game result statuses (incl. abandoned).
pub const API_GAME_RESULT_STATUSES: &[&str] = &["won", "lost", "abandoned"];

/// Dual-oracle residual: adjacent queen conflict direction deltas (8-neighbor).
pub const QUEEN_ADJACENT_DELTAS: &[(i32, i32)] = &[
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
];

/// Dual-oracle residual: region color by region index (wraps).
#[must_use]
pub fn region_color_at(region_index: usize) -> &'static str {
    REGION_COLORS[region_index % REGION_COLORS.len()]
}

/// Dual-oracle residual: known region color class string.
#[must_use]
pub fn is_region_color(class: &str) -> bool {
    REGION_COLORS.contains(&class)
}

/// Dual-oracle residual: region palette size.
#[must_use]
pub fn region_color_count() -> usize {
    REGION_COLORS.len()
}

/// Dual-oracle residual: known API game mode.
#[must_use]
pub fn is_api_game_mode(v: &str) -> bool {
    API_GAME_MODE_VALUES.contains(&v)
}

/// Dual-oracle residual: known API puzzle difficulty.
#[must_use]
pub fn is_api_puzzle_difficulty(v: &str) -> bool {
    API_PUZZLE_DIFFICULTY_VALUES.contains(&v)
}

/// Dual-oracle residual: known API game result status.
#[must_use]
pub fn is_api_game_result_status(v: &str) -> bool {
    API_GAME_RESULT_STATUSES.contains(&v)
}

/// Dual-oracle residual: practice is API-only (not DB game_mode enum).
#[must_use]
pub fn practice_is_api_only_mode() -> bool {
    is_api_game_mode("practice") && API_GAME_MODE_VALUES.len() == 3
}

/// Dual-oracle residual: expert is API-only difficulty ladder extension.
#[must_use]
pub fn expert_is_api_difficulty() -> bool {
    is_api_puzzle_difficulty("expert") && API_PUZZLE_DIFFICULTY_VALUES.len() == 4
}

/// Dual-oracle residual: 8-neighbor adjacency catalog size.
#[must_use]
pub fn queen_adjacent_delta_count() -> usize {
    QUEEN_ADJACENT_DELTAS.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn region_colors_and_api_play_enums_dual_oracle() {
        assert_eq!(region_color_count(), 9);
        assert!(is_region_color("bg-red-400/70 dark:bg-red-500/50"));
        assert!(!is_region_color("bg-gray-400"));
        assert_eq!(region_color_at(0), "bg-red-400/70 dark:bg-red-500/50");
        assert_eq!(region_color_at(9), region_color_at(0));
        assert_eq!(API_GAME_MODE_VALUES, &["daily", "archive", "practice"]);
        assert_eq!(
            API_PUZZLE_DIFFICULTY_VALUES,
            &["easy", "medium", "hard", "expert"]
        );
        assert_eq!(API_GAME_RESULT_STATUSES, &["won", "lost", "abandoned"]);
        assert!(is_api_game_mode("practice"));
        assert!(!is_api_game_mode("tutorial"));
        assert!(is_api_puzzle_difficulty("expert"));
        assert!(!is_api_puzzle_difficulty("nightmare"));
        assert!(is_api_game_result_status("abandoned"));
        assert!(!is_api_game_result_status("draw"));
        assert!(practice_is_api_only_mode());
        assert!(expert_is_api_difficulty());
        assert_eq!(queen_adjacent_delta_count(), 8);
        assert!(QUEEN_ADJACENT_DELTAS.contains(&(-1, -1)));
        assert!(QUEEN_ADJACENT_DELTAS.contains(&(1, 1)));
        assert!(!QUEEN_ADJACENT_DELTAS.contains(&(0, 0)));
    }
}
