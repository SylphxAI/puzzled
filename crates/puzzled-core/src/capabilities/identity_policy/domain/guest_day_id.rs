//! Stable guest-day identity for free-ritual play (North Star protocol).
//!
//! Guests are encouraged for viral landing. Identity is stable enough for
//! one-day anti-cheat + DRC: a UUID bound by the client (device/session) and
//! normalized server-side to `guest_<uuid>` so it never collides with Platform
//! `sub` values.

/// Prefix for guest user ids persisted on `game_sessions.user_id`.
pub const GUEST_USER_ID_PREFIX: &str = "guest_";

/// Normalize a client-supplied guest id into a canonical `guest_<uuid>` user id.
///
/// Accepts:
/// - raw UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
/// - already-prefixed form (`guest_<uuid>`)
///
/// Rejects empty, malformed, or non-UUID strings (fail closed).
#[must_use]
pub fn normalize_guest_user_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let uuid_part = if let Some(rest) = trimmed.strip_prefix(GUEST_USER_ID_PREFIX) {
        rest
    } else {
        trimmed
    };
    if !is_uuid_v4_shape(uuid_part) {
        return None;
    }
    Some(format!("{GUEST_USER_ID_PREFIX}{uuid_part}"))
}

/// True when the user id is a guest-day identity (not a Platform `sub`).
#[must_use]
pub fn is_guest_user_id(user_id: &str) -> bool {
    user_id
        .strip_prefix(GUEST_USER_ID_PREFIX)
        .is_some_and(is_uuid_v4_shape)
}

/// Loose UUID shape check (8-4-4-4-12 hex). Does not enforce version/variant nibble.
fn is_uuid_v4_shape(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 36 {
        return false;
    }
    // positions of hyphens
    if b[8] != b'-' || b[13] != b'-' || b[18] != b'-' || b[23] != b'-' {
        return false;
    }
    for (i, c) in b.iter().enumerate() {
        if i == 8 || i == 13 || i == 18 || i == 23 {
            continue;
        }
        if !c.is_ascii_hexdigit() {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_raw_uuid() {
        let id = normalize_guest_user_id("a1b2c3d4-e5f6-7890-abcd-ef1234567890").unwrap();
        assert_eq!(id, "guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        assert!(is_guest_user_id(&id));
    }

    #[test]
    fn accepts_prefixed() {
        let id = normalize_guest_user_id("guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890").unwrap();
        assert_eq!(id, "guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    }

    #[test]
    fn rejects_garbage() {
        assert!(normalize_guest_user_id("").is_none());
        assert!(normalize_guest_user_id("not-a-uuid").is_none());
        assert!(normalize_guest_user_id("f715210b-9df3-4945-b5bd-94fc4609bc3").is_none()); // short
        assert!(normalize_guest_user_id("user_7q2mggq7fk952vbfcmzh30kf1g").is_none());
    }

    #[test]
    fn platform_sub_is_not_guest() {
        assert!(!is_guest_user_id("f715210b-9df3-4945-b5bd-94fc4609bc30"));
    }
}
