//! Pure role hierarchy helpers —
//! dual-oracle residual of `apps/puzzled/src/lib/roles.ts`.
//! Platform SDK remains authority for role assignment; this is check-only.
//! NO authority_rust / ts_deleted.

/// Platform role levels (higher = more powerful).
#[must_use]
pub fn role_level(role: &str) -> u8 {
    match role {
        "user" => 1,
        "admin" => 2,
        "super_admin" => 3,
        _ => 0,
    }
}

/// Admin or super_admin (TS `isAdminRole`).
#[must_use]
pub fn is_admin_role(role: Option<&str>) -> bool {
    matches!(role, Some("admin") | Some("super_admin"))
}

/// Super-admin only (TS `isSuperAdminRole`).
#[must_use]
pub fn is_super_admin_role(role: Option<&str>) -> bool {
    matches!(role, Some("super_admin"))
}

/// `role_a` has at least the level of `role_b` (TS `_hasMinimumRole`).
#[must_use]
pub fn has_minimum_role(role_a: Option<&str>, role_b: &str) -> bool {
    let Some(a) = role_a else {
        return false;
    };
    let level_a = role_level(a);
    let level_b = role_level(role_b);
    if level_b == 0 {
        // unknown required role → never satisfied (defensive)
        return false;
    }
    level_a >= level_b
}

/// `role_a` strictly higher than `role_b` (TS `_hasHigherRole`).
#[must_use]
pub fn has_higher_role(role_a: Option<&str>, role_b: Option<&str>) -> bool {
    let Some(a) = role_a else {
        return false;
    };
    let level_a = role_level(a);
    let level_b = role_b.map(role_level).unwrap_or(0);
    level_a > level_b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_and_admin_checks() {
        assert_eq!(role_level("user"), 1);
        assert_eq!(role_level("admin"), 2);
        assert_eq!(role_level("super_admin"), 3);
        assert_eq!(role_level("unknown"), 0);
        assert!(!is_admin_role(None));
        assert!(!is_admin_role(Some("user")));
        assert!(is_admin_role(Some("admin")));
        assert!(is_admin_role(Some("super_admin")));
        assert!(!is_super_admin_role(Some("admin")));
        assert!(is_super_admin_role(Some("super_admin")));
    }

    #[test]
    fn minimum_and_higher() {
        assert!(!has_minimum_role(None, "user"));
        assert!(has_minimum_role(Some("user"), "user"));
        assert!(has_minimum_role(Some("admin"), "user"));
        assert!(!has_minimum_role(Some("user"), "admin"));
        assert!(has_minimum_role(Some("super_admin"), "admin"));
        assert!(!has_minimum_role(Some("admin"), "nope"));

        assert!(!has_higher_role(None, Some("user")));
        assert!(has_higher_role(Some("admin"), Some("user")));
        assert!(!has_higher_role(Some("admin"), Some("admin")));
        assert!(has_higher_role(Some("user"), None)); // no b → true if a present
        assert!(has_higher_role(Some("super_admin"), Some("admin")));
    }
}
