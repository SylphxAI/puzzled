//! Pure API key validation residual —
//! dual-oracle of `packages/sdk/src/key-validation.ts` pure halves.
//!
//! Env I/O / console warn remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Environment derived from key prefix.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnvironmentType {
    Development,
    Staging,
    Production,
}

impl EnvironmentType {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Staging => "staging",
            Self::Production => "production",
        }
    }
}

/// Key type dual-oracle.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyType {
    AppId,
    Secret,
}

/// Detect pre-sanitization issues dual-oracle of `detectKeyIssues`.
#[must_use]
pub fn detect_key_issues(key: &str) -> Vec<&'static str> {
    let mut issues = Vec::new();
    if key != key.trim() {
        issues.push("whitespace");
    }
    if key.contains('\n') {
        issues.push("newline");
    }
    if key.contains('\r') {
        issues.push("carriage-return");
    }
    if key.contains(' ') {
        issues.push("space");
    }
    if key != key.to_ascii_lowercase() {
        issues.push("uppercase-chars");
    }
    issues
}

/// App ID pattern: `app_(dev|stg|prod)_[a-z0-9_-]+`
#[must_use]
pub fn is_valid_app_id_format(key: &str) -> bool {
    let Some(rest) = key.strip_prefix("app_") else {
        return false;
    };
    let Some((env, id)) = rest.split_once('_') else {
        return false;
    };
    matches!(env, "dev" | "stg" | "prod")
        && !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
}

/// Secret key pattern: `sk_(dev|stg|prod)_[a-z0-9_-]+`
#[must_use]
pub fn is_valid_secret_key_format(key: &str) -> bool {
    let Some(rest) = key.strip_prefix("sk_") else {
        return false;
    };
    let Some((env, id)) = rest.split_once('_') else {
        return false;
    };
    matches!(env, "dev" | "stg" | "prod")
        && !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
}

/// Extract environment from validated key dual-oracle of `extractEnvironment`.
#[must_use]
pub fn extract_environment(key: &str) -> Option<EnvironmentType> {
    let rest = key
        .strip_prefix("app_")
        .or_else(|| key.strip_prefix("sk_"))?;
    let env = rest.split('_').next()?;
    match env {
        "dev" => Some(EnvironmentType::Development),
        "stg" => Some(EnvironmentType::Staging),
        "prod" => Some(EnvironmentType::Production),
        _ => None,
    }
}

/// Sanitize key (trim + lowercase) dual-oracle of validation path.
#[must_use]
pub fn sanitize_key(key: &str) -> String {
    key.trim().to_ascii_lowercase()
}

/// Validate app id pure residual — returns (valid, sanitized_or_empty, env).
#[must_use]
pub fn validate_app_id(key: Option<&str>) -> (bool, String, Option<EnvironmentType>) {
    let Some(key) = key.filter(|k| !k.is_empty()) else {
        return (false, String::new(), None);
    };
    if is_valid_app_id_format(key) {
        return (true, key.to_string(), extract_environment(key));
    }
    let sanitized = sanitize_key(key);
    if is_valid_app_id_format(&sanitized) {
        let env = extract_environment(&sanitized);
        return (true, sanitized, env);
    }
    (false, String::new(), None)
}

/// Validate secret key pure residual.
#[must_use]
pub fn validate_secret_key(key: Option<&str>) -> (bool, String, Option<EnvironmentType>) {
    let Some(key) = key.filter(|k| !k.is_empty()) else {
        return (false, String::new(), None);
    };
    if is_valid_secret_key_format(key) {
        return (true, key.to_string(), extract_environment(key));
    }
    let sanitized = sanitize_key(key);
    if is_valid_secret_key_format(&sanitized) {
        let env = extract_environment(&sanitized);
        return (true, sanitized, env);
    }
    (false, String::new(), None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_validation_dual_oracle() {
        assert!(is_valid_app_id_format("app_dev_abc123"));
        assert!(is_valid_app_id_format("app_prod_platform_sylphx-console"));
        assert!(!is_valid_app_id_format("app_development_x"));
        assert!(is_valid_secret_key_format("sk_stg_deadbeef"));
        assert!(!is_valid_secret_key_format("pk_dev_x"));

        let issues = detect_key_issues(" APP_DEV_X\n");
        assert!(issues.contains(&"whitespace"));
        assert!(issues.contains(&"newline"));
        assert!(issues.contains(&"uppercase-chars"));

        assert_eq!(
            extract_environment("app_prod_hex"),
            Some(EnvironmentType::Production)
        );
        assert_eq!(
            extract_environment("sk_dev_hex"),
            Some(EnvironmentType::Development)
        );

        let (ok, s, env) = validate_app_id(Some(" APP_DEV_abc "));
        assert!(ok);
        assert_eq!(s, "app_dev_abc");
        assert_eq!(env, Some(EnvironmentType::Development));

        let (ok, _, _) = validate_app_id(None);
        assert!(!ok);
        let (ok, _, _) = validate_secret_key(Some("sk_prod_ok"));
        assert!(ok);
        let _ = (KeyType::AppId, KeyType::Secret);
        assert_eq!(EnvironmentType::Staging.as_str(), "staging");
    }
}
