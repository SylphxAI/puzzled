//! Tryit Plus access policy.
//!
//! - Every player picks up to [`DAILY_FREE_PICKS`] games each product day and
//!   plays them free, guests included. A picked game stays open all day.
//! - A further game that day, and every past day, needs Tryit Plus: an own
//!   subscription, a pass, or a place in a family plan, as Sylphx Money answers.
//! - While sales are closed (Money not configured, or its catalogue sells no
//!   plan) nothing can be bought, so nothing is locked.

/// Games a player may choose to play free on one product day.
pub const DAILY_FREE_PICKS: u32 = 3;

/// May this game be played as one of today's free picks: already chosen
/// today, or a pick is still left.
#[must_use]
pub fn free_pick_open(already_picked: bool, picked_today: u32) -> bool {
    already_picked || picked_today < DAILY_FREE_PICKS
}

/// Why a play request was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlayDenied {
    /// Today's free picks are used and this game is not one of them.
    PlusRequiredForGame,
    /// Any game on a past day.
    PlusRequiredForArchive,
}

impl PlayDenied {
    /// Stable Connect error message the web renders an unlock path for.
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::PlusRequiredForGame => "plus_required",
            Self::PlusRequiredForArchive => "plus_required_archive",
        }
    }
}

/// Decide play access. The caller has already refused future days.
pub fn play_access(
    sales_open: bool,
    entitled: bool,
    is_today: bool,
    free_pick: bool,
) -> Result<(), PlayDenied> {
    if !sales_open || entitled {
        return Ok(());
    }
    if !is_today {
        return Err(PlayDenied::PlusRequiredForArchive);
    }
    if free_pick {
        Ok(())
    } else {
        Err(PlayDenied::PlusRequiredForGame)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn three_picks_stay_open_and_the_rest_needs_plus() {
        // Sales closed: nothing is sold, so nothing is locked.
        assert_eq!(play_access(false, false, false, false), Ok(()));
        // Entitled: everything.
        assert_eq!(play_access(true, true, false, false), Ok(()));
        // Not entitled: today's free picks only.
        assert_eq!(play_access(true, false, true, true), Ok(()));
        assert_eq!(
            play_access(true, false, true, false),
            Err(PlayDenied::PlusRequiredForGame)
        );
        assert_eq!(
            play_access(true, false, false, true),
            Err(PlayDenied::PlusRequiredForArchive)
        );
        assert_eq!(PlayDenied::PlusRequiredForGame.code(), "plus_required");
    }

    #[test]
    fn a_fourth_new_game_is_not_a_free_pick_but_a_chosen_one_stays() {
        assert!(free_pick_open(false, 0));
        assert!(free_pick_open(false, 2));
        assert!(!free_pick_open(false, DAILY_FREE_PICKS));
        assert!(free_pick_open(true, DAILY_FREE_PICKS));
        // A guest and an account merged on sign-in can hold more than three.
        assert!(free_pick_open(true, DAILY_FREE_PICKS + 2));
        assert!(!free_pick_open(false, DAILY_FREE_PICKS + 2));
    }
}
