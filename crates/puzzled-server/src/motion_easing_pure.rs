//! Pure motion easing/spring residual —
//! dual-oracle of `packages/ui/src/motion/config.ts` easing + spring pure halves.
//!
//! Framer Motion / matchMedia I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: easing keys in product insertion order.
pub const EASING_KEYS: &[&str] = &["default", "easeOut", "easeIn", "easeInOut", "sharp"];

/// Dual-oracle residual: cubic-bezier tuples (x1,y1,x2,y2).
pub const EASING_DEFAULT: [f64; 4] = [0.25, 0.1, 0.25, 1.0];
pub const EASING_EASE_OUT: [f64; 4] = [0.0, 0.0, 0.2, 1.0];
pub const EASING_EASE_IN: [f64; 4] = [0.4, 0.0, 1.0, 1.0];
pub const EASING_EASE_IN_OUT: [f64; 4] = [0.4, 0.0, 0.2, 1.0];
pub const EASING_SHARP: [f64; 4] = [0.4, 0.0, 0.6, 1.0];

/// Dual-oracle residual: spring keys.
pub const SPRING_KEYS: &[&str] = &["default", "gentle", "snappy", "bouncy", "stiff"];

/// Dual-oracle residual: spring stiffness catalog.
pub const SPRING_STIFFNESS: &[(&str, i64)] = &[
    ("default", 400),
    ("gentle", 200),
    ("snappy", 500),
    ("bouncy", 300),
    ("stiff", 600),
];

/// Dual-oracle residual: spring damping catalog.
pub const SPRING_DAMPING: &[(&str, i64)] = &[
    ("default", 30),
    ("gentle", 25),
    ("snappy", 30),
    ("bouncy", 15),
    ("stiff", 40),
];

/// Dual-oracle residual: resolve easing cubic-bezier.
#[must_use]
pub fn easing_bezier(key: &str) -> Option<[f64; 4]> {
    Some(match key {
        "default" => EASING_DEFAULT,
        "easeOut" => EASING_EASE_OUT,
        "easeIn" => EASING_EASE_IN,
        "easeInOut" => EASING_EASE_IN_OUT,
        "sharp" => EASING_SHARP,
        _ => return None,
    })
}

/// Dual-oracle residual: resolve spring stiffness.
#[must_use]
pub fn spring_stiffness(key: &str) -> Option<i64> {
    SPRING_STIFFNESS
        .iter()
        .find(|(k, _)| *k == key)
        .map(|(_, v)| *v)
}

/// Dual-oracle residual: resolve spring damping.
#[must_use]
pub fn spring_damping(key: &str) -> Option<i64> {
    SPRING_DAMPING
        .iter()
        .find(|(k, _)| *k == key)
        .map(|(_, v)| *v)
}

/// Dual-oracle residual: spring type tag always `"spring"`.
pub const SPRING_TYPE: &str = "spring";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn motion_easing_spring_dual_oracle() {
        assert_eq!(EASING_KEYS.len(), 5);
        assert_eq!(easing_bezier("default"), Some([0.25, 0.1, 0.25, 1.0]));
        assert_eq!(easing_bezier("easeOut"), Some([0.0, 0.0, 0.2, 1.0]));
        assert_eq!(easing_bezier("easeIn"), Some([0.4, 0.0, 1.0, 1.0]));
        assert_eq!(easing_bezier("easeInOut"), Some([0.4, 0.0, 0.2, 1.0]));
        assert_eq!(easing_bezier("sharp"), Some([0.4, 0.0, 0.6, 1.0]));
        assert_eq!(easing_bezier("nope"), None);
        assert_eq!(SPRING_KEYS.len(), 5);
        assert_eq!(spring_stiffness("default"), Some(400));
        assert_eq!(spring_stiffness("gentle"), Some(200));
        assert_eq!(spring_stiffness("snappy"), Some(500));
        assert_eq!(spring_stiffness("bouncy"), Some(300));
        assert_eq!(spring_stiffness("stiff"), Some(600));
        assert_eq!(spring_damping("bouncy"), Some(15));
        assert_eq!(spring_damping("stiff"), Some(40));
        assert_eq!(SPRING_TYPE, "spring");
    }
}


// ── product residual dens wave74: motion easing+spring catalog dual-oracle residual ──
// Dual-oracle residual of motion easing / spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easing keys closed five + bezier head/tail.
#[must_use]
pub fn wave74_easing_catalog_shell() -> bool {
    EASING_KEYS.len() == 5
        && easing_bezier("default") == Some([0.25, 0.1, 0.25, 1.0])
        && easing_bezier("sharp") == Some([0.4, 0.0, 0.6, 1.0])
        && easing_bezier("easeOut") == Some([0.0, 0.0, 0.2, 1.0])
        && easing_bezier("nope").is_none()
}

/// Dual-oracle residual: spring stiffness/damping catalog.
#[must_use]
pub fn wave74_spring_catalog_shell() -> bool {
    SPRING_KEYS.len() == 5
        && spring_stiffness("default") == Some(400)
        && spring_stiffness("gentle") == Some(200)
        && spring_stiffness("stiff") == Some(600)
        && spring_damping("bouncy") == Some(15)
        && spring_damping("stiff") == Some(40)
        && spring_stiffness("x").is_none()
}

/// Dual-oracle residual: spring type tag.
#[must_use]
pub fn wave74_spring_type_shell() -> bool {
    SPRING_TYPE == "spring"
}

#[cfg(test)]
mod wave74_tests {
    use super::*;

    #[test]
    fn wave74_motion_easing_spring_catalog_dual_oracle() {
        assert!(wave74_easing_catalog_shell());
        assert!(wave74_spring_catalog_shell());
        assert!(wave74_spring_type_shell());
    }
}
