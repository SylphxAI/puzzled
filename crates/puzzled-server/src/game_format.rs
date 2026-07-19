//! Shared game format/score pure helpers — mirrors
//! `apps/puzzled/src/games/shared/format.ts`.

/// Format milliseconds as `M:SS` or `H:MM:SS` timer.
#[must_use]
pub fn format_timer(ms: u64) -> String {
    let total_seconds = ms / 1000;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    if hours > 0 {
        format!("{hours}:{:02}:{:02}", minutes, seconds)
    } else {
        format!("{minutes}:{:02}", seconds)
    }
}

/// Perfect game: won with zero mistakes.
#[must_use]
pub fn is_perfect_game(status_won: bool, mistakes: u32) -> bool {
    status_won && mistakes == 0
}

/// Wordle-style scoring: 100 - (attempts-1)*15, min 25 on win; 0 on loss.
#[must_use]
pub fn calculate_wordle_score(won: bool, attempts: u32) -> u32 {
    if !won {
        return 0;
    }
    let penalty = attempts.saturating_sub(1).saturating_mul(15);
    100u32.saturating_sub(penalty).max(25)
}

/// Format share score: "Lost" | timer | "N pts" | "Won".
#[must_use]
pub fn format_time_score(
    status_lost: bool,
    time_spent_ms: Option<u64>,
    score: Option<u32>,
) -> String {
    if status_lost {
        return "Lost".into();
    }
    if let Some(ms) = time_spent_ms {
        if ms > 0 {
            return format_timer(ms);
        }
    }
    if let Some(s) = score {
        if s > 0 {
            return format!("{s} pts");
        }
    }
    "Won".into()
}

/// Compare completion by time: winners beat losers; among winners, lower time wins.
/// Returns positive when `a` ranks better than `b` (mirrors TS return sign usage).
#[must_use]
pub fn compare_by_time(
    a_won: bool,
    a_time_ms: Option<u64>,
    b_won: bool,
    b_time_ms: Option<u64>,
) -> i64 {
    if a_won && !b_won {
        return 1;
    }
    if !a_won && b_won {
        return -1;
    }
    let a_t = a_time_ms.unwrap_or(u64::MAX) as i64;
    let b_t = b_time_ms.unwrap_or(u64::MAX) as i64;
    // TS: (b.time - a.time) — faster (smaller) ranks higher when used as sort comparator inverted
    b_t - a_t
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timer_formats() {
        assert_eq!(format_timer(45_000), "0:45");
        assert_eq!(format_timer(90_000), "1:30");
        assert_eq!(format_timer(3_690_000), "1:01:30");
    }

    #[test]
    fn wordle_score_table() {
        assert_eq!(calculate_wordle_score(false, 1), 0);
        assert_eq!(calculate_wordle_score(true, 1), 100);
        assert_eq!(calculate_wordle_score(true, 2), 85);
        assert_eq!(calculate_wordle_score(true, 6), 25);
        assert_eq!(calculate_wordle_score(true, 10), 25);
    }

    #[test]
    fn perfect_and_share() {
        assert!(is_perfect_game(true, 0));
        assert!(!is_perfect_game(true, 1));
        assert_eq!(format_time_score(true, Some(1000), None), "Lost");
        assert_eq!(format_time_score(false, Some(90_000), None), "1:30");
        assert_eq!(format_time_score(false, None, Some(42)), "42 pts");
    }

    #[test]
    fn compare_winners() {
        assert!(compare_by_time(true, Some(1000), false, Some(100)) > 0);
        assert!(compare_by_time(true, Some(1000), true, Some(2000)) > 0);
    }
}
