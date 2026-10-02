//! The reverse trial: a new player who has finished three days gets every
//! game for seven days, once per account, then drops back to the free floor.
//! The trial is Puzzled's own time-boxed access (Sylphx Money has no grant
//! API for it); nothing is charged and nothing is taken away afterwards.

/// Finished days after which the trial is granted.
pub const FINISHED_DAYS_TO_GRANT: i64 = 3;
/// How long the trial runs.
pub const TRIAL_DAYS: i64 = 7;
const DAY_MS: i64 = 86_400_000;

/// Where an account stands with its one trial.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrialState {
    /// Not on, or the account has not finished enough days yet.
    Pending,
    /// Granted and still running; access ends at `ends_at_ms`.
    Active { ends_at_ms: i64 },
    /// Granted before and over; there is never a second grant.
    Used,
}

/// When a trial granted at `now_ms` ends.
#[must_use]
pub fn ends_at(now_ms: i64) -> i64 {
    now_ms + TRIAL_DAYS * DAY_MS
}

/// Should a trial be granted now: enabled, none granted before, and three
/// days finished.
#[must_use]
pub fn should_grant(enabled: bool, granted: Option<i64>, finished_days: i64) -> bool {
    enabled && granted.is_none() && finished_days >= FINISHED_DAYS_TO_GRANT
}

/// The state of a stored grant (`ends_at_ms`) at `now_ms`.
#[must_use]
pub fn state_of(granted_ends_at_ms: Option<i64>, now_ms: i64) -> TrialState {
    match granted_ends_at_ms {
        Some(end) if end > now_ms => TrialState::Active { ends_at_ms: end },
        Some(_) => TrialState::Used,
        None => TrialState::Pending,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn granted_after_the_third_finished_day_once_and_only_when_enabled() {
        assert!(!should_grant(true, None, 2));
        assert!(should_grant(true, None, 3));
        assert!(should_grant(true, None, 40));
        assert!(!should_grant(false, None, 3));
        // One grant per account, even long after it ended.
        assert!(!should_grant(true, Some(1), 40));
    }

    #[test]
    fn runs_seven_days_then_is_used() {
        let end = ends_at(1_000);
        assert_eq!(end, 1_000 + 7 * 86_400_000);
        assert_eq!(state_of(None, 5), TrialState::Pending);
        assert_eq!(
            state_of(Some(end), end - 1),
            TrialState::Active { ends_at_ms: end }
        );
        assert_eq!(state_of(Some(end), end), TrialState::Used);
    }
}
