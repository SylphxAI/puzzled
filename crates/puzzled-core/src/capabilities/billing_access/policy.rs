//! Puzzled Plus access policy.
//!
//! - Today's featured game ([`crate::puzzle_play::game_slugs::todays_free_game`])
//!   is free to everyone, guests included.
//! - Every other game, and every past day, needs Puzzled Plus: an own
//!   subscription or a place in a family plan.
//! - While sales are closed (no payment processor configured, or its published
//!   prices differ from the catalogue) nothing can be bought, so nothing is
//!   locked.
//!
//! The plan facts — ids, intervals, prices, family seats and the cancellation
//! window — are the commercial catalogue's ([`super::catalogue`],
//! `config/commercial/catalogue.json`). Nothing here restates them.

use super::catalogue::catalogue;

/// Plan ids, in the order the pricing page shows them.
pub fn plan_ids() -> impl Iterator<Item = &'static str> {
    catalogue().plan_ids()
}

/// Price lookup keys for every plan.
pub fn plan_lookup_keys() -> impl Iterator<Item = &'static str> {
    catalogue().plan_lookup_keys()
}

/// People on one family plan, the owner included.
#[must_use]
pub fn family_max_members() -> u32 {
    catalogue().family_max_members()
}

/// Days after the first subscription starts in which cancelling refunds it in
/// full (UK Consumer Contracts Regulations 2013 cancellation period).
#[must_use]
pub fn cancellation_days() -> u32 {
    catalogue().cancellation_days()
}

/// Where a plan sits in the catalogue's order, for stable listings.
#[must_use]
pub fn plan_rank(plan_id: &str) -> Option<usize> {
    catalogue().plan_rank(plan_id)
}

/// Price lookup key for a plan id, when it is one of ours.
#[must_use]
pub fn price_lookup_key(plan_id: &str) -> Option<&'static str> {
    catalogue()
        .plan(plan_id)
        .map(|plan| plan.provider_lookup_key.as_str())
}

/// Plan id for a price lookup key, when it is one of ours.
#[must_use]
pub fn plan_id_from_lookup_key(lookup_key: &str) -> Option<&'static str> {
    catalogue().plan_id_from_lookup_key(lookup_key)
}

#[must_use]
pub fn is_known_plan(plan_id: &str) -> bool {
    catalogue().plan(plan_id).is_some()
}

/// A family plan shares access with the owner's family members.
#[must_use]
pub fn is_family_plan(plan_id: &str) -> bool {
    catalogue().is_family_plan(plan_id)
}

/// The declared amount for a plan in a currency, in minor units.
#[must_use]
pub fn declared_amount(plan_id: &str, currency: &str) -> Option<i64> {
    catalogue().declared_amount(plan_id, currency)
}

/// True when a Stripe subscription in `status` still grants access at `now_ms`.
///
/// `past_due` keeps access while Stripe retries the renewal, bounded by the
/// paid period; `incomplete`, `unpaid`, `canceled` and unknown states never
/// grant.
#[must_use]
pub fn subscription_grants_access(status: &str, current_period_end_ms: i64, now_ms: i64) -> bool {
    matches!(status, "active" | "trialing" | "past_due") && current_period_end_ms > now_ms
}

const DAY_MS: i64 = 86_400_000;

/// The end of the refund window for a subscription, or None when it has none.
///
/// Only an account's first subscription is refundable: re-subscribing to
/// collect a second refund is not a cancellation right.
#[must_use]
pub fn refund_until_ms(started_at_ms: i64, first_subscription: bool) -> Option<i64> {
    first_subscription.then(|| started_at_ms + i64::from(cancellation_days()) * DAY_MS)
}

/// What a cancellation does at `now_ms`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cancellation {
    /// Inside the cancellation window: end access now and refund in full.
    RefundNow,
    /// After it: keep access to the end of the paid period, then stop.
    AtPeriodEnd,
}

#[must_use]
pub fn cancellation(refund_until_ms: Option<i64>, now_ms: i64) -> Cancellation {
    match refund_until_ms {
        Some(until) if now_ms < until => Cancellation::RefundNow,
        _ => Cancellation::AtPeriodEnd,
    }
}

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
    fn lookup_keys_round_trip_and_reject_foreign_prices() {
        for plan in plan_ids() {
            assert_eq!(
                plan_id_from_lookup_key(&price_lookup_key(plan).unwrap()),
                Some(plan)
            );
            assert!(is_known_plan(plan));
        }
        assert_eq!(plan_id_from_lookup_key("puzzled_lifetime"), None);
        assert_eq!(plan_id_from_lookup_key("individual_monthly"), None);
        assert!(is_family_plan("family_yearly"));
        assert!(!is_family_plan("individual_yearly"));
        assert!(!is_family_plan("lifetime"));
    }

    #[test]
    fn only_paid_states_inside_the_period_grant_access() {
        let now = 1_000_000;
        assert!(subscription_grants_access("active", now + 1, now));
        assert!(subscription_grants_access("trialing", now + 1, now));
        assert!(subscription_grants_access("past_due", now + 1, now));
        assert!(!subscription_grants_access("active", now, now));
        for status in [
            "incomplete",
            "incomplete_expired",
            "unpaid",
            "canceled",
            "paused",
            "",
        ] {
            assert!(
                !subscription_grants_access(status, now + 1, now),
                "{status}"
            );
        }
    }

    #[test]
    fn first_subscription_refunds_inside_the_cancellation_window_only() {
        let start = 10 * DAY_MS;
        let window = i64::from(cancellation_days()) * DAY_MS;
        let until = refund_until_ms(start, true);
        assert_eq!(until, Some(start + window));
        assert_eq!(
            cancellation(until, start + window - 1),
            Cancellation::RefundNow
        );
        assert_eq!(
            cancellation(until, start + window),
            Cancellation::AtPeriodEnd
        );
        assert_eq!(refund_until_ms(start, false), None);
        assert_eq!(cancellation(None, start), Cancellation::AtPeriodEnd);
    }

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
