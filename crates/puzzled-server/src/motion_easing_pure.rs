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


// ── product residual dens wave75: motion easing mid+spring dual-oracle residual ──
// Dual-oracle residual of motion easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easing mid keys + unknown reject.
#[must_use]
pub fn wave75_easing_mid_shell() -> bool {
    EASING_KEYS == ["default", "easeOut", "easeIn", "easeInOut", "sharp"]
        && easing_bezier("easeIn") == Some([0.4, 0.0, 1.0, 1.0])
        && easing_bezier("easeInOut") == Some([0.4, 0.0, 0.2, 1.0])
        && easing_bezier("easeOut") == Some([0.0, 0.0, 0.2, 1.0])
        && easing_bezier("missing").is_none()
}

/// Dual-oracle residual: spring snappy/bouncy/gentle stiffness+damping.
#[must_use]
pub fn wave75_spring_mid_shell() -> bool {
    SPRING_KEYS.len() == 5
        && spring_stiffness("snappy") == Some(500)
        && spring_stiffness("bouncy") == Some(300)
        && spring_stiffness("gentle") == Some(200)
        && spring_damping("snappy") == Some(30)
        && spring_damping("gentle") == Some(25)
        && spring_damping("bouncy") == Some(15)
        && spring_stiffness("nope").is_none()
}

/// Dual-oracle residual: spring type tag + default pair.
#[must_use]
pub fn wave75_spring_default_shell() -> bool {
    SPRING_TYPE == "spring"
        && spring_stiffness("default") == Some(400)
        && spring_damping("default") == Some(30)
}

#[cfg(test)]
mod wave75_tests {
    use super::*;

    #[test]
    fn wave75_motion_easing_mid_spring_dual_oracle() {
        assert!(wave75_easing_mid_shell());
        assert!(wave75_spring_mid_shell());
        assert!(wave75_spring_default_shell());
    }
}


// ── product residual dens wave76: motion easing sharp+spring stiff dual-oracle residual ──
// Dual-oracle residual of motion config easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: sharp easing + easeInOut bezier closed.
#[must_use]
pub fn wave76_easing_sharp_shell() -> bool {
    easing_bezier("sharp") == Some(EASING_SHARP)
        && EASING_SHARP == [0.4, 0.0, 0.6, 1.0]
        && easing_bezier("easeInOut") == Some(EASING_EASE_IN_OUT)
        && EASING_EASE_IN_OUT == [0.4, 0.0, 0.2, 1.0]
        && easing_bezier("unknown").is_none()
        && EASING_KEYS.contains(&"sharp")
}

/// Dual-oracle residual: stiff spring stiffness/damping extremes.
#[must_use]
pub fn wave76_spring_stiff_shell() -> bool {
    spring_stiffness("stiff") == Some(600)
        && spring_damping("stiff") == Some(40)
        && spring_stiffness("gentle") == Some(200)
        && spring_damping("gentle") == Some(25)
        && spring_stiffness("nope").is_none()
        && SPRING_KEYS.contains(&"stiff")
}

/// Dual-oracle residual: spring type tag + default pair + key counts.
#[must_use]
pub fn wave76_spring_default_catalog_shell() -> bool {
    SPRING_TYPE == "spring"
        && spring_stiffness("default") == Some(400)
        && spring_damping("default") == Some(30)
        && EASING_KEYS.len() == 5
        && SPRING_KEYS.len() == 5
        && SPRING_STIFFNESS.len() == 5
        && SPRING_DAMPING.len() == 5
}

#[cfg(test)]
mod wave76_tests {
    use super::*;

    #[test]
    fn wave76_motion_easing_sharp_spring_stiff_dual_oracle() {
        assert!(wave76_easing_sharp_shell());
        assert!(wave76_spring_stiff_shell());
        assert!(wave76_spring_default_catalog_shell());
    }
}


// ── product residual dens wave77: motion easing easeInOut+spring gentle dual-oracle residual ──
// Dual-oracle residual of motion config easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easeInOut + easeIn bezier closed.
#[must_use]
pub fn wave77_easing_ease_in_out_shell() -> bool {
    easing_bezier("easeInOut") == Some(EASING_EASE_IN_OUT)
        && easing_bezier("easeIn") == Some(EASING_EASE_IN)
        && EASING_EASE_IN_OUT == [0.4, 0.0, 0.2, 1.0]
        && EASING_EASE_IN == [0.4, 0.0, 1.0, 1.0]
        && easing_bezier("nope").is_none()
}

/// Dual-oracle residual: spring gentle + bouncy stiffness/damping.
#[must_use]
pub fn wave77_spring_gentle_bouncy_shell() -> bool {
    spring_stiffness("gentle") == Some(200)
        && spring_damping("gentle") == Some(25)
        && spring_stiffness("bouncy") == Some(300)
        && spring_damping("bouncy") == Some(15)
        && SPRING_TYPE == "spring"
}

/// Dual-oracle residual: catalog lengths + default keys present.
#[must_use]
pub fn wave77_motion_catalog_shell() -> bool {
    EASING_KEYS.len() == 5
        && SPRING_KEYS.len() == 5
        && EASING_KEYS.contains(&"default")
        && SPRING_KEYS.contains(&"default")
        && spring_stiffness("default") == Some(400)
        && spring_damping("default") == Some(30)
        && easing_bezier("default") == Some(EASING_DEFAULT)
}

#[cfg(test)]
mod wave77_tests {
    use super::*;

    #[test]
    fn wave77_motion_easing_ease_in_out_spring_gentle_dual_oracle() {
        assert!(wave77_easing_ease_in_out_shell());
        assert!(wave77_spring_gentle_bouncy_shell());
        assert!(wave77_motion_catalog_shell());
    }
}


// ── product residual dens wave78: motion easeOut+spring snappy/stiff dual-oracle residual ──
// Dual-oracle residual of motion config easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easeOut + sharp bezier closed.
#[must_use]
pub fn wave78_easing_ease_out_sharp_shell() -> bool {
    easing_bezier("easeOut") == Some(EASING_EASE_OUT)
        && easing_bezier("sharp") == Some(EASING_SHARP)
        && EASING_EASE_OUT == [0.0, 0.0, 0.2, 1.0]
        && EASING_SHARP == [0.4, 0.0, 0.6, 1.0]
        && easing_bezier("linear").is_none()
}

/// Dual-oracle residual: spring snappy + stiff stiffness/damping.
#[must_use]
pub fn wave78_spring_snappy_stiff_shell() -> bool {
    spring_stiffness("snappy") == Some(500)
        && spring_damping("snappy") == Some(30)
        && spring_stiffness("stiff") == Some(600)
        && spring_damping("stiff") == Some(40)
        && SPRING_TYPE == "spring"
}

/// Dual-oracle residual: key catalogs ordered + unknown reject.
#[must_use]
pub fn wave78_motion_keys_shell() -> bool {
    EASING_KEYS == ["default", "easeOut", "easeIn", "easeInOut", "sharp"]
        && SPRING_KEYS == ["default", "gentle", "snappy", "bouncy", "stiff"]
        && spring_stiffness("nope").is_none()
        && spring_damping("nope").is_none()
        && easing_bezier("EaseOut").is_none()
}

#[cfg(test)]
mod wave78_tests {
    use super::*;

    #[test]
    fn wave78_motion_ease_out_spring_snappy_stiff_dual_oracle() {
        assert!(wave78_easing_ease_out_sharp_shell());
        assert!(wave78_spring_snappy_stiff_shell());
        assert!(wave78_motion_keys_shell());
    }
}


// ── product residual dens wave79: motion easeIn+spring gentle/bouncy dual-oracle residual ──
// Dual-oracle residual of motion config easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easeIn + easeInOut + default bezier closed.
#[must_use]
pub fn wave79_easing_in_inout_shell() -> bool {
    easing_bezier("easeIn") == Some(EASING_EASE_IN)
        && easing_bezier("easeInOut") == Some(EASING_EASE_IN_OUT)
        && easing_bezier("default") == Some(EASING_DEFAULT)
        && EASING_EASE_IN == [0.4, 0.0, 1.0, 1.0]
        && EASING_EASE_IN_OUT == [0.4, 0.0, 0.2, 1.0]
        && easing_bezier("easein").is_none()
}

/// Dual-oracle residual: spring gentle + bouncy stiffness/damping.
#[must_use]
pub fn wave79_spring_gentle_bouncy_shell() -> bool {
    spring_stiffness("gentle") == Some(200)
        && spring_damping("gentle") == Some(25)
        && spring_stiffness("bouncy") == Some(300)
        && spring_damping("bouncy") == Some(15)
        && spring_stiffness("default") == Some(400)
        && spring_damping("default") == Some(30)
}

/// Dual-oracle residual: key catalog lengths + type tag.
#[must_use]
pub fn wave79_motion_catalog_len_shell() -> bool {
    EASING_KEYS.len() == 5
        && SPRING_KEYS.len() == 5
        && SPRING_TYPE == "spring"
        && spring_stiffness("unknown").is_none()
        && easing_bezier("sharp") == Some(EASING_SHARP)
}

#[cfg(test)]
mod wave79_tests {
    use super::*;

    #[test]
    fn wave79_motion_ease_in_spring_gentle_bouncy_dual_oracle() {
        assert!(wave79_easing_in_inout_shell());
        assert!(wave79_spring_gentle_bouncy_shell());
        assert!(wave79_motion_catalog_len_shell());
    }
}


// ── product residual dens wave80: motion easeOut+spring snappy/stiff dual-oracle residual ──
// Dual-oracle residual of motion config easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easeOut + sharp bezier closed.
#[must_use]
pub fn wave80_easing_out_sharp_shell() -> bool {
    easing_bezier("easeOut") == Some(EASING_EASE_OUT)
        && easing_bezier("sharp") == Some(EASING_SHARP)
        && EASING_EASE_OUT == [0.0, 0.0, 0.2, 1.0]
        && EASING_SHARP == [0.4, 0.0, 0.6, 1.0]
        && EASING_DEFAULT == [0.25, 0.1, 0.25, 1.0]
        && easing_bezier("linear").is_none()
}

/// Dual-oracle residual: spring snappy + stiff stiffness/damping.
#[must_use]
pub fn wave80_spring_snappy_stiff_shell() -> bool {
    spring_stiffness("snappy") == Some(500)
        && spring_damping("snappy") == Some(30)
        && spring_stiffness("stiff") == Some(600)
        && spring_damping("stiff") == Some(40)
        && spring_stiffness("nope").is_none()
}

/// Dual-oracle residual: key catalogs closed five + spring type tag.
#[must_use]
pub fn wave80_motion_keys_type_shell() -> bool {
    EASING_KEYS == ["default", "easeOut", "easeIn", "easeInOut", "sharp"]
        && SPRING_KEYS == ["default", "gentle", "snappy", "bouncy", "stiff"]
        && SPRING_TYPE == "spring"
        && EASING_KEYS.len() == 5
        && SPRING_KEYS.len() == 5
}

#[cfg(test)]
mod wave80_tests {
    use super::*;

    #[test]
    fn wave80_motion_ease_out_snappy_stiff_dual_oracle() {
        assert!(wave80_easing_out_sharp_shell());
        assert!(wave80_spring_snappy_stiff_shell());
        assert!(wave80_motion_keys_type_shell());
    }
}


// ── product residual dens wave81: motion easeIn+gentle/bouncy dual-oracle residual ──
// Dual-oracle residual of motion config easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easeIn + easeInOut bezier closed.
#[must_use]
pub fn wave81_easing_in_inout_shell() -> bool {
    easing_bezier("easeIn") == Some(EASING_EASE_IN)
        && easing_bezier("easeInOut") == Some(EASING_EASE_IN_OUT)
        && EASING_EASE_IN == [0.4, 0.0, 1.0, 1.0]
        && EASING_EASE_IN_OUT == [0.4, 0.0, 0.2, 1.0]
        && easing_bezier("EaseIn").is_none()
}

/// Dual-oracle residual: spring gentle + bouncy stiffness/damping.
#[must_use]
pub fn wave81_spring_gentle_bouncy_shell() -> bool {
    spring_stiffness("gentle") == Some(200)
        && spring_damping("gentle") == Some(25)
        && spring_stiffness("bouncy") == Some(300)
        && spring_damping("bouncy") == Some(15)
        && spring_stiffness("default") == Some(400)
}

/// Dual-oracle residual: default easing + spring type + key counts.
#[must_use]
pub fn wave81_motion_default_keys_shell() -> bool {
    easing_bezier("default") == Some(EASING_DEFAULT)
        && SPRING_TYPE == "spring"
        && EASING_KEYS.len() == 5
        && SPRING_KEYS.len() == 5
        && SPRING_KEYS.contains(&"gentle")
        && SPRING_KEYS.contains(&"bouncy")
}

#[cfg(test)]
mod wave81_tests {
    use super::*;

    #[test]
    fn wave81_motion_ease_in_gentle_bouncy_dual_oracle() {
        assert!(wave81_easing_in_inout_shell());
        assert!(wave81_spring_gentle_bouncy_shell());
        assert!(wave81_motion_default_keys_shell());
    }
}


// ── product residual dens wave82: motion easeOut/sharp+snappy/stiff dual-oracle residual ──
// Dual-oracle residual of motion config easing/spring pure halves.
// Framer Motion / matchMedia I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: easeOut + sharp bezier closed.
#[must_use]
pub fn wave82_easing_out_sharp_shell() -> bool {
    easing_bezier("easeOut") == Some(EASING_EASE_OUT)
        && easing_bezier("sharp") == Some(EASING_SHARP)
        && EASING_EASE_OUT == [0.0, 0.0, 0.2, 1.0]
        && EASING_SHARP == [0.4, 0.0, 0.6, 1.0]
        && easing_bezier("ease_out").is_none()
}

/// Dual-oracle residual: snappy + stiff spring poles.
#[must_use]
pub fn wave82_spring_snappy_stiff_shell() -> bool {
    spring_stiffness("snappy") == Some(500)
        && spring_damping("snappy") == Some(30)
        && spring_stiffness("stiff") == Some(600)
        && spring_damping("stiff") == Some(40)
        && spring_stiffness("nope").is_none()
}

/// Dual-oracle residual: default spring + catalog keys closed five.
#[must_use]
pub fn wave82_motion_default_catalog_shell() -> bool {
    spring_stiffness("default") == Some(400)
        && spring_damping("default") == Some(30)
        && EASING_KEYS.len() == 5
        && SPRING_KEYS.len() == 5
        && SPRING_TYPE == "spring"
        && SPRING_KEYS.contains(&"snappy")
        && SPRING_KEYS.contains(&"stiff")
}

#[cfg(test)]
mod wave82_tests {
    use super::*;

    #[test]
    fn wave82_motion_out_sharp_snappy_stiff_dual_oracle() {
        assert!(wave82_easing_out_sharp_shell());
        assert!(wave82_spring_snappy_stiff_shell());
        assert!(wave82_motion_default_catalog_shell());
    }
}
