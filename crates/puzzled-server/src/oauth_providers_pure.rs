//! Pure OAuth provider catalog residual —
//! dual-oracle of `packages/sdk/src/types.ts` `OAUTH_PROVIDERS` pure half.
//!
//! OAuth redirect / token exchange I/O remains product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: OAuth provider id catalog (product order).
pub const OAUTH_PROVIDERS: &[&str] = &[
    "google",
    "github",
    "apple",
    "microsoft",
    "facebook",
    "twitter",
    "discord",
    "linkedin",
    "slack",
    "gitlab",
    "bitbucket",
    "twitch",
    "spotify",
];

/// Dual-oracle residual: known provider membership.
#[must_use]
pub fn is_oauth_provider(id: &str) -> bool {
    OAUTH_PROVIDERS.contains(&id)
}

/// Dual-oracle residual: provider at index (wrap), dual of catalog access.
#[must_use]
pub fn oauth_provider_at(index: usize) -> &'static str {
    OAUTH_PROVIDERS[index % OAUTH_PROVIDERS.len()]
}

/// Dual-oracle residual: index of provider id.
#[must_use]
pub fn oauth_provider_index(id: &str) -> Option<usize> {
    OAUTH_PROVIDERS.iter().position(|p| *p == id)
}

/// Dual-oracle residual: major social providers subset used for UI prioritization.
pub const OAUTH_PRIMARY_PROVIDERS: &[&str] = &["google", "github", "apple", "microsoft"];

/// Dual-oracle residual: whether provider is in the primary set.
#[must_use]
pub fn is_primary_oauth_provider(id: &str) -> bool {
    OAUTH_PRIMARY_PROVIDERS.contains(&id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked21_oauth_providers_dual_oracle() {
        assert_eq!(OAUTH_PROVIDERS.len(), 13);
        assert_eq!(OAUTH_PROVIDERS[0], "google");
        assert_eq!(OAUTH_PROVIDERS[12], "spotify");
        assert!(is_oauth_provider("discord"));
        assert!(!is_oauth_provider("yahoo"));
        assert_eq!(oauth_provider_at(0), "google");
        assert_eq!(oauth_provider_at(13), "google");
        assert_eq!(oauth_provider_index("github"), Some(1));
        assert_eq!(oauth_provider_index("nope"), None);
        assert_eq!(OAUTH_PRIMARY_PROVIDERS.len(), 4);
        assert!(is_primary_oauth_provider("apple"));
        assert!(!is_primary_oauth_provider("twitch"));
        for p in OAUTH_PRIMARY_PROVIDERS {
            assert!(is_oauth_provider(p));
        }
    }
}
