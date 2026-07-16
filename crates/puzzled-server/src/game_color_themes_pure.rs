//! Pure game color theme catalog residual —
//! dual-oracle of `apps/puzzled/src/games/theme-colors.ts` pure halves
//! (theme ids + solid bg Tailwind class tokens; full pattern strings stay product).
//!
//! UI class wiring residual remains product residual.
//! NO authority_rust / ts_deleted invent.

#![allow(dead_code)]

/// Dual-oracle residual: GameColorTheme union members in GAME_COLOR_THEMES order.
pub const GAME_COLOR_THEME_IDS: &[&str] = &[
    "emerald", "cyan", "violet", "amber", "pink", "rose", "blue", "sky", "orange",
    "lime", "slate",
];

/// Dual-oracle residual: solid bg classes aligned with theme ids.
pub const GAME_COLOR_THEME_BG: &[&str] = &[
    "bg-emerald-500",
    "bg-cyan-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-pink-500",
    "bg-rose-500",
    "bg-blue-500",
    "bg-sky-500",
    "bg-orange-500",
    "bg-lime-500",
    "bg-slate-500",
];

/// Dual-oracle residual: text color classes aligned with theme ids.
pub const GAME_COLOR_THEME_TEXT: &[&str] = &[
    "text-emerald-500",
    "text-cyan-500",
    "text-violet-500",
    "text-amber-500",
    "text-pink-500",
    "text-rose-500",
    "text-blue-500",
    "text-sky-500",
    "text-orange-500",
    "text-lime-500",
    "text-slate-500",
];

/// Dual-oracle residual: known theme membership.
#[must_use]
pub fn is_game_color_theme(id: &str) -> bool {
    GAME_COLOR_THEME_IDS.contains(&id)
}

/// Dual-oracle residual: solid bg class for theme.
#[must_use]
pub fn game_color_theme_bg(id: &str) -> Option<&'static str> {
    GAME_COLOR_THEME_IDS
        .iter()
        .position(|t| *t == id)
        .map(|i| GAME_COLOR_THEME_BG[i])
}

/// Dual-oracle residual: text class for theme.
#[must_use]
pub fn game_color_theme_text(id: &str) -> Option<&'static str> {
    GAME_COLOR_THEME_IDS
        .iter()
        .position(|t| *t == id)
        .map(|i| GAME_COLOR_THEME_TEXT[i])
}

/// Dual-oracle residual: theme count.
#[must_use]
pub fn game_color_theme_count() -> usize {
    GAME_COLOR_THEME_IDS.len()
}

/// Dual-oracle residual: game→theme pure map (config.theme fields).
#[must_use]
pub fn theme_for_game_slug(slug: &str) -> Option<&'static str> {
    Some(match slug {
        "word-guess" => "emerald",
        "sudoku" | "word-search" | "word-box" => "cyan",
        "queens" | "cryptogram" | "word-groups" => "violet",
        "word-hive" | "tango" | "quad-words" => "amber",
        "nonogram" => "pink",
        "killer-sudoku" => "rose",
        "crossword" => "blue",
        "pattern-match" => "sky",
        "word-ladder" => "orange",
        "arithmo" => "lime",
        "block-slide" => "slate",
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked19_game_color_themes_dual_oracle() {
        assert_eq!(game_color_theme_count(), 11);
        assert_eq!(GAME_COLOR_THEME_IDS[0], "emerald");
        assert_eq!(GAME_COLOR_THEME_IDS[game_color_theme_count() - 1], "slate");
        assert!(is_game_color_theme("violet"));
        assert!(!is_game_color_theme("indigo"));
        assert_eq!(game_color_theme_bg("emerald"), Some("bg-emerald-500"));
        assert_eq!(game_color_theme_text("slate"), Some("text-slate-500"));
        assert_eq!(game_color_theme_bg("nope"), None);
        assert_eq!(theme_for_game_slug("word-guess"), Some("emerald"));
        assert_eq!(theme_for_game_slug("tango"), Some("amber"));
        assert_eq!(theme_for_game_slug("block-slide"), Some("slate"));
        assert_eq!(theme_for_game_slug("nope"), None);
        for id in GAME_COLOR_THEME_IDS {
            assert!(is_game_color_theme(id));
            assert!(game_color_theme_bg(id).is_some());
            assert!(game_color_theme_text(id).is_some());
        }
    }
}
