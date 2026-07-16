//! Pure motion duration residual —
//! dual-oracle of `packages/ui/src/motion/config.ts` `duration` catalog pure halves.
//!
//! Framer Motion / matchMedia reduced-motion I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: duration.instant (seconds).
pub const DURATION_INSTANT: f64 = 0.0;
/// Dual-oracle residual: duration.fast.
pub const DURATION_FAST: f64 = 0.1;
/// Dual-oracle residual: duration.normal.
pub const DURATION_NORMAL: f64 = 0.15;
/// Dual-oracle residual: duration.medium.
pub const DURATION_MEDIUM: f64 = 0.2;
/// Dual-oracle residual: duration.slow.
pub const DURATION_SLOW: f64 = 0.3;
/// Dual-oracle residual: duration.slower.
pub const DURATION_SLOWER: f64 = 0.4;
/// Dual-oracle residual: duration.slowest.
pub const DURATION_SLOWEST: f64 = 0.5;

/// Dual-oracle residual: duration keys in product insertion order.
pub const DURATION_KEYS: &[&str] = &[
    "instant", "fast", "normal", "medium", "slow", "slower", "slowest",
];

/// Dual-oracle residual: resolve duration seconds by key.
#[must_use]
pub fn duration_seconds(key: &str) -> Option<f64> {
    Some(match key {
        "instant" => DURATION_INSTANT,
        "fast" => DURATION_FAST,
        "normal" => DURATION_NORMAL,
        "medium" => DURATION_MEDIUM,
        "slow" => DURATION_SLOW,
        "slower" => DURATION_SLOWER,
        "slowest" => DURATION_SLOWEST,
        _ => return None,
    })
}

/// Dual-oracle residual: duration is micro-interaction class (≤ normal).
#[must_use]
pub fn is_micro_duration(key: &str) -> bool {
    matches!(key, "instant" | "fast" | "normal")
}

/// Dual-oracle residual: stagger.fast / normal / slow (seconds).
pub const STAGGER_FAST: f64 = 0.03;
pub const STAGGER_NORMAL: f64 = 0.05;
pub const STAGGER_SLOW: f64 = 0.08;

#[must_use]
pub fn is_stagger_key(key: &str) -> bool {
    matches!(key, "fast" | "normal" | "slow")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn motion_duration_dual_oracle() {
        assert_eq!(DURATION_KEYS.len(), 7);
        assert_eq!(duration_seconds("instant"), Some(0.0));
        assert_eq!(duration_seconds("fast"), Some(0.1));
        assert_eq!(duration_seconds("normal"), Some(0.15));
        assert_eq!(duration_seconds("medium"), Some(0.2));
        assert_eq!(duration_seconds("slow"), Some(0.3));
        assert_eq!(duration_seconds("slower"), Some(0.4));
        assert_eq!(duration_seconds("slowest"), Some(0.5));
        assert_eq!(duration_seconds("nope"), None);
        assert!(is_micro_duration("fast"));
        assert!(!is_micro_duration("slow"));
        assert!((STAGGER_FAST - 0.03).abs() < 1e-12);
        assert!((STAGGER_NORMAL - 0.05).abs() < 1e-12);
        assert!((STAGGER_SLOW - 0.08).abs() < 1e-12);
        assert!(is_stagger_key("fast"));
        assert!(!is_stagger_key("instant"));
    }
}
