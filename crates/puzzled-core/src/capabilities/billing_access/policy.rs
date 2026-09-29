//! Puzzled Plus access policy.
//!
//! - Today's featured game ([`crate::puzzle_play::game_slugs::todays_free_game`])
//!   is free to everyone, guests included.
//! - Every other game, and every past day, needs Puzzled Plus: an own
//!   subscription or a place in a family plan, as Sylphx Money answers.
//! - While sales are closed (Money not configured, or its catalogue sells no
//!   plan) nothing can be bought, so nothing is locked.

/// Why a play request was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlayDenied {
    /// A game other than today's free one, on today's date.
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
    game_free_today: bool,
) -> Result<(), PlayDenied> {
    if !sales_open || entitled {
        return Ok(());
    }
    if !is_today {
        return Err(PlayDenied::PlusRequiredForArchive);
    }
    if game_free_today {
        Ok(())
    } else {
        Err(PlayDenied::PlusRequiredForGame)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_daily_stays_open_and_the_rest_needs_plus() {
        // Sales closed: nothing is sold, so nothing is locked.
        assert_eq!(play_access(false, false, false, false), Ok(()));
        // Entitled: everything.
        assert_eq!(play_access(true, true, false, false), Ok(()));
        // Not entitled: today's free game only.
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
}
