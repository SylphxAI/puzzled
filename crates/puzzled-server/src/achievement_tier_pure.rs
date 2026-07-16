//! Pure achievement-tier residual —
//! dual-oracle of `packages/sdk/src/lib/engagement/types.ts`
//! `ACHIEVEMENT_TIER_CONFIG` pure catalog half.
//!
//! Engagement DB / streak I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: achievement tier ladder (product order).
pub const ACHIEVEMENT_TIERS: &[&str] = &["bronze", "silver", "gold", "platinum", "diamond"];

/// Dual-oracle residual: tier → points.
pub const ACHIEVEMENT_TIER_POINTS: &[(&str, u32)] = &[
    ("bronze", 10),
    ("silver", 25),
    ("gold", 50),
    ("platinum", 100),
    ("diamond", 200),
];

/// Dual-oracle residual: tier → UI color hex.
pub const ACHIEVEMENT_TIER_COLORS: &[(&str, &str)] = &[
    ("bronze", "#CD7F32"),
    ("silver", "#C0C0C0"),
    ("gold", "#FFD700"),
    ("platinum", "#00CED1"),
    ("diamond", "#B9F2FF"),
];

/// Dual-oracle residual: known achievement tier.
#[must_use]
pub fn is_achievement_tier(tier: &str) -> bool {
    ACHIEVEMENT_TIERS.contains(&tier)
}

/// Dual-oracle residual: points for tier.
#[must_use]
pub fn achievement_tier_points(tier: &str) -> Option<u32> {
    ACHIEVEMENT_TIER_POINTS
        .iter()
        .find(|(t, _)| *t == tier)
        .map(|(_, p)| *p)
}

/// Dual-oracle residual: color for tier.
#[must_use]
pub fn achievement_tier_color(tier: &str) -> Option<&'static str> {
    ACHIEVEMENT_TIER_COLORS
        .iter()
        .find(|(t, _)| *t == tier)
        .map(|(_, c)| *c)
}

/// Dual-oracle residual: tier ladder is strictly increasing by points.
#[must_use]
pub fn achievement_points_strictly_increasing() -> bool {
    let mut prev = 0u32;
    for (_, p) in ACHIEVEMENT_TIER_POINTS {
        if *p <= prev {
            return false;
        }
        prev = *p;
    }
    true
}

/// Dual-oracle residual: diamond is top tier by points.
#[must_use]
pub fn top_achievement_tier() -> &'static str {
    "diamond"
}

// ── wave69 pure residual dens: achievement tier ladder dual-oracle residual ──

#[cfg(test)]
mod wave69_tests {
    use super::*;

    #[test]
    fn wave69_achievement_tier_ladder_dual_oracle() {
        assert_eq!(ACHIEVEMENT_TIERS.len(), 5);
        assert_eq!(ACHIEVEMENT_TIERS[0], "bronze");
        assert_eq!(ACHIEVEMENT_TIERS[4], "diamond");
        assert!(is_achievement_tier("gold"));
        assert!(!is_achievement_tier("iron"));
        assert_eq!(achievement_tier_points("bronze"), Some(10));
        assert_eq!(achievement_tier_points("silver"), Some(25));
        assert_eq!(achievement_tier_points("gold"), Some(50));
        assert_eq!(achievement_tier_points("platinum"), Some(100));
        assert_eq!(achievement_tier_points("diamond"), Some(200));
        assert_eq!(achievement_tier_points("nope"), None);
        assert_eq!(achievement_tier_color("bronze"), Some("#CD7F32"));
        assert_eq!(achievement_tier_color("diamond"), Some("#B9F2FF"));
        assert!(achievement_points_strictly_increasing());
        assert_eq!(top_achievement_tier(), "diamond");
        assert_eq!(ACHIEVEMENT_TIER_POINTS.len(), ACHIEVEMENT_TIERS.len());
        assert_eq!(ACHIEVEMENT_TIER_COLORS.len(), ACHIEVEMENT_TIERS.len());
    }
}
