//! Pure reduced-motion residual —
//! dual-oracle of `packages/ui/src/motion/use-reduced-motion.ts` pure halves.
//!
//! matchMedia / React effect I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: prefers-reduced-motion media query.
pub const REDUCED_MOTION_MEDIA_QUERY: &str = "(prefers-reduced-motion: reduce)";

/// Dual-oracle residual: SSR / first-paint default (false until client hydrates).
#[must_use]
pub fn reduced_motion_ssr_default() -> bool {
    false
}

/// Dual-oracle residual: map mediaQuery.matches → prefersReduced.
#[must_use]
pub fn prefers_reduced_from_matches(matches: bool) -> bool {
    matches
}

/// Dual-oracle residual: safe animation props empty when reduced.
#[must_use]
pub fn reduced_motion_safe_animation_empty(prefers_reduced: bool) -> bool {
    prefers_reduced
}

/// Dual-oracle residual: media query is the WCAG 2.3.3 reduce query.
#[must_use]
pub fn is_reduced_motion_query(query: &str) -> bool {
    query == REDUCED_MOTION_MEDIA_QUERY
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reduced_motion_dual_oracle() {
        assert_eq!(
            REDUCED_MOTION_MEDIA_QUERY,
            "(prefers-reduced-motion: reduce)"
        );
        assert!(!reduced_motion_ssr_default());
        assert!(prefers_reduced_from_matches(true));
        assert!(!prefers_reduced_from_matches(false));
        assert!(reduced_motion_safe_animation_empty(true));
        assert!(!reduced_motion_safe_animation_empty(false));
        assert!(is_reduced_motion_query(REDUCED_MOTION_MEDIA_QUERY));
        assert!(!is_reduced_motion_query("(prefers-color-scheme: dark)"));
    }
}
