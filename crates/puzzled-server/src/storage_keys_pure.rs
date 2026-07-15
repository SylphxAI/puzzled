//! Pure localStorage key builders —
//! dual-oracle residual of `apps/puzzled/src/lib/storage-keys.ts`.
//! Browser storage I/O stays FE-TS. NO authority_rust / ts_deleted.

/// Consent cookie key.
pub const CONSENT_KEY: &str = "puzzled:consent:cookie";
/// Consent timestamp key.
pub const CONSENT_TIMESTAMP_KEY: &str = "puzzled:consent:timestamp";
/// Sound enabled key.
pub const SOUND_ENABLED_KEY: &str = "puzzled:sound:enabled";
/// PWA prompt dismissed key.
pub const PWA_PROMPT_DISMISSED_KEY: &str = "puzzled:pwa:prompt-dismissed";
/// Guest onboarding key.
pub const GUEST_ONBOARDING_KEY: &str = "puzzled:guest:onboarding";
/// Guest games key.
pub const GUEST_GAMES_KEY: &str = "puzzled:guest:games";
/// Analytics offline queue key.
pub const ANALYTICS_OFFLINE_QUEUE_KEY: &str = "puzzled:analytics:offline-queue";
/// Session start key.
pub const SESSION_START_KEY: &str = "puzzled:session:start";
/// Session id key.
pub const SESSION_ID_KEY: &str = "puzzled:session:id";

/// Game session started key (TS `getGameSessionKey`).
#[must_use]
pub fn get_game_session_key(game_slug: &str, puzzle_id: Option<&str>) -> String {
    match puzzle_id {
        Some(pid) if !pid.is_empty() => format!("puzzled:game:{game_slug}:{pid}:started"),
        _ => format!("puzzled:game:{game_slug}:started"),
    }
}

/// Prefixed namespaced key helper (domain + key, colon-separated).
#[must_use]
pub fn namespaced_key(domain: &str, key: &str) -> String {
    format!("puzzled:{domain}:{key}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn static_keys_dual_oracle() {
        assert_eq!(CONSENT_KEY, "puzzled:consent:cookie");
        assert_eq!(CONSENT_TIMESTAMP_KEY, "puzzled:consent:timestamp");
        assert_eq!(SOUND_ENABLED_KEY, "puzzled:sound:enabled");
        assert_eq!(PWA_PROMPT_DISMISSED_KEY, "puzzled:pwa:prompt-dismissed");
        assert_eq!(GUEST_ONBOARDING_KEY, "puzzled:guest:onboarding");
        assert_eq!(GUEST_GAMES_KEY, "puzzled:guest:games");
        assert_eq!(ANALYTICS_OFFLINE_QUEUE_KEY, "puzzled:analytics:offline-queue");
        assert_eq!(SESSION_START_KEY, "puzzled:session:start");
        assert_eq!(SESSION_ID_KEY, "puzzled:session:id");
    }

    #[test]
    fn game_session_key() {
        assert_eq!(
            get_game_session_key("word-guess", None),
            "puzzled:game:word-guess:started"
        );
        assert_eq!(
            get_game_session_key("sudoku", Some("p-1")),
            "puzzled:game:sudoku:p-1:started"
        );
        assert_eq!(
            get_game_session_key("sudoku", Some("")),
            "puzzled:game:sudoku:started"
        );
        assert_eq!(namespaced_key("consent", "cookie"), CONSENT_KEY);
    }
}
