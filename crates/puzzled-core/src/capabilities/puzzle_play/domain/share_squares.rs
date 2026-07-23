//! Pure share-square / avatar-icon residual —
//! dual-oracle of `packages/ui/src/components/game-icons.tsx`
//! AVATAR_ICONS / CATEGORY_COLORS / SHARE_SQUARES pure catalogs.
//!
//! Framer Motion / clipboard I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: leaderboard avatar icon catalog.
pub const AVATAR_ICONS: &[&str] = &[
    "mdi:trophy",
    "mdi:medal",
    "mdi:star",
    "mdi:target",
    "mdi:fire",
    "mdi:crown",
    "mdi:lightning-bolt",
    "mdi:brain",
    "mdi:book-open-variant",
    "mdi:school",
];

/// Dual-oracle residual: category color names (word groups).
pub const CATEGORY_COLORS: &[&str] = &["rose", "teal", "amber", "fuchsia"];

/// Dual-oracle residual: share square glyphs.
pub const SHARE_CORRECT: &str = "🟪";
pub const SHARE_PARTIAL: &str = "🟧";
pub const SHARE_WRONG: &str = "⬛";
pub const SHARE_ROSE: &str = "🟥";
pub const SHARE_TEAL: &str = "🩵";
pub const SHARE_AMBER: &str = "🟨";
pub const SHARE_FUCHSIA: &str = "🟪";

/// Dual-oracle residual: avatar icon by index (wrap).
#[must_use]
pub fn avatar_icon_at(index: usize) -> &'static str {
    AVATAR_ICONS[index % AVATAR_ICONS.len()]
}

/// Dual-oracle residual: category color by index 0..3.
#[must_use]
pub fn category_color_at(index: usize) -> Option<&'static str> {
    CATEGORY_COLORS.get(index).copied()
}

/// Dual-oracle residual: share glyph for guess result.
#[must_use]
pub fn share_square_for_result(result: &str) -> Option<&'static str> {
    match result {
        "correct" => Some(SHARE_CORRECT),
        "partial" => Some(SHARE_PARTIAL),
        "wrong" => Some(SHARE_WRONG),
        "rose" => Some(SHARE_ROSE),
        "teal" => Some(SHARE_TEAL),
        "amber" => Some(SHARE_AMBER),
        "fuchsia" => Some(SHARE_FUCHSIA),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wave61_share_squares_dual_oracle() {
        assert_eq!(AVATAR_ICONS.len(), 10);
        assert_eq!(avatar_icon_at(0), "mdi:trophy");
        assert_eq!(avatar_icon_at(10), "mdi:trophy");
        assert_eq!(CATEGORY_COLORS.len(), 4);
        assert_eq!(category_color_at(0), Some("rose"));
        assert_eq!(category_color_at(3), Some("fuchsia"));
        assert_eq!(category_color_at(4), None);
        assert_eq!(share_square_for_result("correct"), Some("🟪"));
        assert_eq!(share_square_for_result("partial"), Some("🟧"));
        assert_eq!(share_square_for_result("wrong"), Some("⬛"));
        assert_eq!(share_square_for_result("teal"), Some("🩵"));
        assert_eq!(share_square_for_result("nope"), None);
    }
}
