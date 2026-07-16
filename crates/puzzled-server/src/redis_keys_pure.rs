//! Pure Redis key residual —
//! dual-oracle of `apps/puzzled/src/lib/redis.ts#keys` pure halves.
//!
//! Redis I/O remains product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle of `IMPERSONATION_TTL` (1 hour, seconds).
pub const IMPERSONATION_TTL_SECS: u64 = 60 * 60;

/// Dual-oracle of `keys.dailyPuzzle`.
#[must_use]
pub fn daily_puzzle_key(game_slug: &str, date: &str) -> String {
    format!("puzzle:{game_slug}:{date}")
}

/// Dual-oracle of `keys.leaderboard`.
#[must_use]
pub fn leaderboard_key(game_slug: &str, period: &str) -> Option<String> {
    match period {
        "daily" | "weekly" | "all" => Some(format!("leaderboard:{game_slug}:{period}")),
        _ => None,
    }
}

/// Dual-oracle of `keys.userStreak`.
#[must_use]
pub fn user_streak_key(user_id: &str, game_slug: &str) -> String {
    format!("streak:{user_id}:{game_slug}")
}

/// Dual-oracle of `keys.sessionCache`.
#[must_use]
pub fn session_cache_key(session_id: &str) -> String {
    format!("session:{session_id}")
}

/// Dual-oracle of `keys.impersonation`.
#[must_use]
pub fn impersonation_key(admin_user_id: &str) -> String {
    format!("impersonate:{admin_user_id}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redis_keys_dual_oracle() {
        assert_eq!(IMPERSONATION_TTL_SECS, 3600);
        assert_eq!(
            daily_puzzle_key("word-guess", "2026-07-16"),
            "puzzle:word-guess:2026-07-16"
        );
        assert_eq!(
            leaderboard_key("sudoku", "weekly").as_deref(),
            Some("leaderboard:sudoku:weekly")
        );
        assert!(leaderboard_key("sudoku", "monthly").is_none());
        assert_eq!(user_streak_key("u1", "tango"), "streak:u1:tango");
        assert_eq!(session_cache_key("s1"), "session:s1");
        assert_eq!(impersonation_key("admin"), "impersonate:admin");
    }
}
