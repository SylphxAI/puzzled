//! Platform RS256 / JWKS identity verification for puzzled-server.
#![allow(clippy::expect_used)]
//!
//! Caller-supplied `x-user-id` is never trusted as identity. Protected routes
//! must present a Bearer JWT whose signature verifies against Platform JWKS
//! (or an explicit test/dev decoding key). `sub` is the only accepted user id.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::http::{header, HeaderMap, StatusCode};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

const DEFAULT_JWKS_URL: &str = "https://api.sylphx.com/.well-known/jwks.json";
const JWKS_CACHE_TTL: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JwtError {
    MissingBearer,
    MalformedToken,
    VerificationFailed(String),
    MissingSubject,
    JwksUnavailable(String),
    AudienceMismatch,
}

impl JwtError {
    #[must_use]
    pub fn message(&self) -> &'static str {
        match self {
            Self::MissingBearer => "Missing Authorization Bearer token",
            Self::MalformedToken => "Malformed JWT",
            Self::VerificationFailed(_) => "JWT verification failed",
            Self::MissingSubject => "JWT missing subject",
            Self::JwksUnavailable(_) => "JWKS unavailable",
            Self::AudienceMismatch => "JWT audience rejected",
        }
    }

    #[must_use]
    pub fn status(&self) -> StatusCode {
        match self {
            Self::JwksUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            _ => StatusCode::UNAUTHORIZED,
        }
    }

    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::MissingBearer => "missing_bearer",
            Self::MalformedToken => "malformed_token",
            Self::VerificationFailed(_) => "jwt_verification_failed",
            Self::MissingSubject => "missing_subject",
            Self::JwksUnavailable(_) => "jwks_unavailable",
            Self::AudienceMismatch => "audience_mismatch",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformClaims {
    pub sub: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub aud: Option<serde_json::Value>,
    #[serde(default)]
    pub iss: Option<String>,
    #[serde(default)]
    pub app_id: Option<String>,
    /// Optional admin / scope claim for admin-gated residual.
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
    pub exp: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedIdentity {
    pub user_id: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub is_admin: bool,
}

#[derive(Debug, Deserialize)]
struct JwksDocument {
    keys: Vec<Jwk>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)] // JWKS document fields retained for future alg/use enforcement
struct Jwk {
    kty: String,
    #[serde(default)]
    kid: Option<String>,
    #[serde(default)]
    alg: Option<String>,
    #[serde(default)]
    n: Option<String>,
    #[serde(default)]
    e: Option<String>,
    #[serde(rename = "use", default)]
    key_use: Option<String>,
}

struct JwksCache {
    fetched_at: Instant,
    keys: HashMap<String, DecodingKey>,
    /// keys without kid
    unkeyed: Vec<DecodingKey>,
}

static JWKS_CACHE: OnceLock<Mutex<Option<JwksCache>>> = OnceLock::new();
static TEST_DECODING_KEY_PEM: OnceLock<Mutex<Option<String>>> = OnceLock::new();
/// Process-lifetime blocking client. Must NOT be dropped inside an async
/// context (tokio panics on runtime drop from async); keeping it static means
/// it is never dropped per-request.
static JWKS_BLOCKING_CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();

fn jwks_blocking_client() -> &'static reqwest::blocking::Client {
    JWKS_BLOCKING_CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("jwks blocking client")
    })
}

/// Shared lock so tests that install/clear the process-local test key do not
/// race with each other (used by lib tests and this module's tests).
pub fn test_key_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn jwks_url() -> String {
    std::env::var("PLATFORM_JWKS_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_JWKS_URL.to_string())
}

fn expected_audience() -> Option<String> {
    std::env::var("PLATFORM_JWT_AUDIENCE")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn expected_issuer() -> Option<String> {
    std::env::var("PLATFORM_JWT_ISSUER")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Install a process-local decoding key for unit tests (RS256 PEM).
pub fn install_test_decoding_key_pem(pem: &str) -> Result<(), String> {
    // Validate PEM shape early.
    let _ = DecodingKey::from_rsa_pem(pem.as_bytes()).map_err(|e| e.to_string())?;
    let cell = TEST_DECODING_KEY_PEM.get_or_init(|| Mutex::new(None));
    if let Ok(mut g) = cell.lock() {
        *g = Some(pem.to_string());
    }
    Ok(())
}

pub fn clear_test_decoding_key() {
    if let Some(cell) = TEST_DECODING_KEY_PEM.get() {
        if let Ok(mut g) = cell.lock() {
            *g = None;
        }
    }
}

fn test_decoding_key() -> Option<DecodingKey> {
    let pem = TEST_DECODING_KEY_PEM
        .get()
        .and_then(|c| c.lock().ok().and_then(|g| g.clone()))?;
    DecodingKey::from_rsa_pem(pem.as_bytes()).ok()
}

/// Parse `PLATFORM_JWT_PUBLIC_KEY_PEM`, tolerating JSON-escaped newlines.
///
/// Returns `None` when the value is not a loadable RSA PEM so callers can fall
/// through to JWKS instead of failing closed on a corrupted env secret.
fn decoding_key_from_pem_env(pem: &str) -> Option<DecodingKey> {
    let trimmed = pem.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Prefer real newlines; also accept literal `\n` sequences from secret JSON.
    let candidates = [trimmed.to_string(), trimmed.replace("\\n", "\n")];
    for candidate in candidates {
        if let Ok(key) = DecodingKey::from_rsa_pem(candidate.as_bytes()) {
            return Some(key);
        }
    }
    None
}

/// Extract Bearer token from Authorization header only (cookies may be opaque
/// session ids — those are not Platform JWTs and fail closed here).
#[must_use]
pub fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let rest = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))?;
    let token = rest.trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

fn is_admin_from_claims(claims: &PlatformClaims) -> bool {
    // Product-issued exact `admin` only. Platform operator scopes are not
    // Puzzled admin (100% dogfood: no first-party skip).
    let is_admin_scope = |s: &str| s == "admin";
    if let Some(scope) = &claims.scope {
        if scope.split_whitespace().any(is_admin_scope) {
            return true;
        }
    }
    if let Some(scopes) = &claims.scopes {
        if scopes.iter().any(|s| is_admin_scope(s)) {
            return true;
        }
    }
    false
}

/// True when identity verification must be fully constrained (production).
fn enforcement_enabled() -> bool {
    std::env::var("PUZZLED_ENV")
        .map(|v| v.trim().eq_ignore_ascii_case("production"))
        .unwrap_or(false)
}

fn validation_config() -> Result<Validation, JwtError> {
    validation_config_inner(
        expected_audience(),
        expected_issuer(),
        enforcement_enabled(),
    )
}

fn validation_config_inner(
    audience: Option<String>,
    issuer: Option<String>,
    enforce: bool,
) -> Result<Validation, JwtError> {
    let mut v = Validation::new(Algorithm::RS256);
    v.validate_exp = true;
    match audience {
        Some(aud) => v.set_audience(&[aud]),
        None if enforce => {
            return Err(JwtError::JwksUnavailable(
                "PLATFORM_JWT_AUDIENCE not configured (required in production)".into(),
            ));
        }
        None => v.validate_aud = false,
    }
    match issuer {
        Some(iss) => v.set_issuer(&[iss]),
        None if enforce => {
            return Err(JwtError::JwksUnavailable(
                "PLATFORM_JWT_ISSUER not configured (required in production)".into(),
            ));
        }
        None => {}
    }
    Ok(v)
}

fn decode_with_key(token: &str, key: &DecodingKey) -> Result<PlatformClaims, JwtError> {
    let config = validation_config()?;
    let data = decode::<PlatformClaims>(token, key, &config)
        .map_err(|e| JwtError::VerificationFailed(e.to_string()))?;
    if data.claims.sub.trim().is_empty() {
        return Err(JwtError::MissingSubject);
    }
    Ok(data.claims)
}

fn fetch_jwks_blocking() -> Result<JwksCache, JwtError> {
    let url = jwks_url();
    let client = jwks_blocking_client();
    let doc: JwksDocument = client
        .get(&url)
        .send()
        .map_err(|e| JwtError::JwksUnavailable(e.to_string()))?
        .error_for_status()
        .map_err(|e| JwtError::JwksUnavailable(e.to_string()))?
        .json()
        .map_err(|e| JwtError::JwksUnavailable(e.to_string()))?;

    let mut keys = HashMap::new();
    let mut unkeyed = Vec::new();
    for jwk in doc.keys {
        if jwk.kty != "RSA" {
            continue;
        }
        let Some(n) = jwk.n.as_deref() else { continue };
        let Some(e) = jwk.e.as_deref() else { continue };
        let Ok(key) = DecodingKey::from_rsa_components(n, e) else {
            continue;
        };
        if let Some(kid) = jwk.kid.filter(|s| !s.is_empty()) {
            keys.insert(kid, key);
        } else {
            unkeyed.push(key);
        }
    }
    if keys.is_empty() && unkeyed.is_empty() {
        return Err(JwtError::JwksUnavailable(
            "JWKS contained no RSA keys".into(),
        ));
    }
    Ok(JwksCache {
        fetched_at: Instant::now(),
        keys,
        unkeyed,
    })
}

fn jwks_cache_get() -> Result<std::sync::MutexGuard<'static, Option<JwksCache>>, JwtError> {
    let cell = JWKS_CACHE.get_or_init(|| Mutex::new(None));
    let mut guard = cell
        .lock()
        .map_err(|_| JwtError::JwksUnavailable("jwks mutex poisoned".into()))?;
    let needs_refresh = match guard.as_ref() {
        None => true,
        Some(c) => c.fetched_at.elapsed() > JWKS_CACHE_TTL,
    };
    if needs_refresh {
        *guard = Some(fetch_jwks_blocking()?);
    }
    Ok(guard)
}

fn header_kid(token: &str) -> Option<String> {
    let header_b64 = token.split('.').next()?;
    // jsonwebtoken can decode header; use manual base64 for kid only
    let padded = match header_b64.len() % 4 {
        2 => format!("{header_b64}=="),
        3 => format!("{header_b64}="),
        _ => header_b64.to_string(),
    };
    let bytes = base64::Engine::decode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        header_b64,
    )
    .or_else(|_| base64::Engine::decode(&base64::engine::general_purpose::URL_SAFE, &padded))
    .ok()?;
    let v: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    v.get("kid").and_then(|k| k.as_str()).map(|s| s.to_string())
}

/// Verify a raw JWT string against test key or Platform JWKS.
pub fn verify_platform_jwt(token: &str) -> Result<VerifiedIdentity, JwtError> {
    let token = token.trim();
    if token.is_empty() {
        return Err(JwtError::MissingBearer);
    }
    if token.split('.').count() != 3 {
        return Err(JwtError::MalformedToken);
    }

    // Unit-test / local override key first.
    if let Some(key) = test_decoding_key() {
        let claims = decode_with_key(token, &key)?;
        return Ok(VerifiedIdentity {
            user_id: claims.sub.trim().to_string(),
            display_name: claims.name.clone(),
            email: claims.email.clone(),
            is_admin: is_admin_from_claims(&claims),
        });
    }

    // Optional static PEM via env for single-tenant / offline.
    // Platform secret injection may store PEM with literal `\n` (JSON-escaped).
    // Accept real newlines and escaped form. On parse failure, fall through to
    // JWKS — a broken PEM must not mask a working key set (live residual:
    // literal `\n` PEM → identity_required_for_submit for all Bearer JWTs).
    if let Ok(pem) = std::env::var("PLATFORM_JWT_PUBLIC_KEY_PEM") {
        if !pem.trim().is_empty() {
            if let Some(key) = decoding_key_from_pem_env(&pem) {
                let claims = decode_with_key(token, &key)?;
                return Ok(VerifiedIdentity {
                    user_id: claims.sub.trim().to_string(),
                    display_name: claims.name.clone(),
                    email: claims.email.clone(),
                    is_admin: is_admin_from_claims(&claims),
                });
            }
        }
    }

    let cache = jwks_cache_get()?;
    let cache = cache
        .as_ref()
        .ok_or_else(|| JwtError::JwksUnavailable("empty jwks cache".into()))?;

    let mut last_err = JwtError::VerificationFailed("no keys tried".into());
    if let Some(kid) = header_kid(token) {
        if let Some(key) = cache.keys.get(&kid) {
            match decode_with_key(token, key) {
                Ok(claims) => {
                    return Ok(VerifiedIdentity {
                        user_id: claims.sub.trim().to_string(),
                        display_name: claims.name.clone(),
                        email: claims.email.clone(),
                        is_admin: is_admin_from_claims(&claims),
                    });
                }
                Err(e) => last_err = e,
            }
        }
    }
    for key in cache.keys.values().chain(cache.unkeyed.iter()) {
        match decode_with_key(token, key) {
            Ok(claims) => {
                return Ok(VerifiedIdentity {
                    user_id: claims.sub.trim().to_string(),
                    display_name: claims.name.clone(),
                    email: claims.email.clone(),
                    is_admin: is_admin_from_claims(&claims),
                });
            }
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

/// Resolve verified identity from request headers. Never trusts `x-user-id`.
pub fn resolve_verified_identity(headers: &HeaderMap) -> Result<VerifiedIdentity, JwtError> {
    let Some(token) = extract_bearer(headers) else {
        return Err(JwtError::MissingBearer);
    };
    verify_platform_jwt(&token)
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    fn lock() -> std::sync::MutexGuard<'static, ()> {
        super::test_key_lock()
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    use super::*;
    use axum::http::HeaderValue;
    use jsonwebtoken::{encode, EncodingKey, Header as JwtHeader};

    const TEST_PUB_PEM: &str = include_str!("../../../../testdata/platform_jwt_test_pub.pem");
    const TEST_PRIV_PEM: &str = include_str!("../../../../testdata/platform_jwt_test_priv.pem");

    #[derive(Serialize)]
    struct MintClaims {
        sub: String,
        name: String,
        exp: i64,
        #[serde(skip_serializing_if = "Option::is_none")]
        scope: Option<String>,
    }

    fn mint_token(sub: &str, scope: Option<&str>) -> String {
        install_test_decoding_key_pem(TEST_PUB_PEM).expect("install key");
        let claims = MintClaims {
            sub: sub.to_string(),
            name: "Test User".to_string(),
            exp: chrono::Utc::now().timestamp() + 3600,
            scope: scope.map(str::to_string),
        };
        let key = EncodingKey::from_rsa_pem(TEST_PRIV_PEM.as_bytes()).expect("enc key");
        encode(&JwtHeader::new(Algorithm::RS256), &claims, &key).expect("mint")
    }

    #[test]
    fn rejects_missing_bearer() {
        let _g = lock();
        clear_test_decoding_key();
        let h = HeaderMap::new();
        let err = resolve_verified_identity(&h).unwrap_err();
        assert_eq!(err, JwtError::MissingBearer);
    }

    #[test]
    fn rejects_x_user_id_without_jwt() {
        let _g = lock();
        clear_test_decoding_key();
        let mut h = HeaderMap::new();
        h.insert("x-user-id", HeaderValue::from_static("attacker"));
        let err = resolve_verified_identity(&h).unwrap_err();
        assert_eq!(err, JwtError::MissingBearer);
    }

    #[test]
    fn verifies_rs256_and_extracts_sub() {
        let _g = lock();
        let token = mint_token("user_01hxyz", None);
        let mut h = HeaderMap::new();
        h.insert(
            header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {token}")).unwrap(),
        );
        let id = resolve_verified_identity(&h).expect("verified");
        assert_eq!(id.user_id, "user_01hxyz");
        assert_eq!(id.display_name.as_deref(), Some("Test User"));
        assert!(!id.is_admin);
    }

    #[test]
    fn admin_scope_detected() {
        let _g = lock();
        let token = mint_token("admin_1", Some("admin"));
        let id = verify_platform_jwt(&token).expect("verified");
        assert!(id.is_admin);
        clear_test_decoding_key();
    }

    #[test]
    fn platform_admin_scope_does_not_grant_product_admin() {
        let _g = lock();
        let token = mint_token("ops_1", Some("platform:admin"));
        let id = verify_platform_jwt(&token).expect("verified");
        assert!(
            !id.is_admin,
            "platform operator scope must not skip product admin"
        );
        clear_test_decoding_key();
    }

    #[test]
    fn admin_scope_suffix_does_not_grant_admin() {
        let _g = lock();
        let token = mint_token("user_1", Some("puzzled:user"));
        let id = verify_platform_jwt(&token).expect("verified");
        assert!(!id.is_admin);
        let token = mint_token("user_2", Some("editor:admin"));
        let id = verify_platform_jwt(&token).expect("verified");
        assert!(!id.is_admin, "suffix match must not grant admin");
        clear_test_decoding_key();
    }

    #[test]
    fn production_enforcement_requires_audience_and_issuer() {
        // Pure inner config check: no process-global env mutation, deterministic.
        assert!(matches!(
            validation_config_inner(None, None, true),
            Err(JwtError::JwksUnavailable(_))
        ));
        assert!(
            validation_config_inner(Some("puzzled".into()), Some("sylphx".into()), true,).is_ok()
        );
        assert!(validation_config_inner(None, None, false).is_ok());
    }

    #[test]
    fn rejects_string_typed_exp_claim() {
        let _g = lock();
        install_test_decoding_key_pem(TEST_PUB_PEM).expect("install key");
        let claims = serde_json::json!({
            "sub": "user_string_exp",
            "name": "Test User",
            "exp": "9999999999",
        });
        let key = EncodingKey::from_rsa_pem(TEST_PRIV_PEM.as_bytes()).expect("enc key");
        let token = encode(&JwtHeader::new(Algorithm::RS256), &claims, &key).expect("mint");
        let err = verify_platform_jwt(&token).unwrap_err();
        assert!(
            matches!(err, JwtError::VerificationFailed(_)),
            "string-typed exp must fail closed for GHSA-h395, got {err:?}"
        );
        clear_test_decoding_key();
    }

    #[test]
    fn rejects_garbage_token() {
        let _g = lock();
        install_test_decoding_key_pem(TEST_PUB_PEM).expect("install key");
        let err = verify_platform_jwt("not-a-jwt").unwrap_err();
        assert_eq!(err, JwtError::MalformedToken);
        clear_test_decoding_key();
    }

    #[test]
    fn pem_env_accepts_literal_backslash_n() {
        let _g = lock();
        clear_test_decoding_key();
        let escaped = TEST_PUB_PEM.replace('\n', "\\n");
        assert!(
            escaped.contains("\\n") && !escaped.contains('\n'),
            "fixture must be single-line escaped form"
        );
        let key = decoding_key_from_pem_env(&escaped).expect("escaped PEM must load");
        let token = {
            install_test_decoding_key_pem(TEST_PUB_PEM).expect("install");
            let claims = MintClaims {
                sub: "escaped_pem_user".into(),
                name: "Escaped".into(),
                exp: chrono::Utc::now().timestamp() + 3600,
                scope: None,
            };
            let enc = EncodingKey::from_rsa_pem(TEST_PRIV_PEM.as_bytes()).expect("enc");
            encode(&JwtHeader::new(Algorithm::RS256), &claims, &enc).expect("mint")
        };
        clear_test_decoding_key();
        let claims = decode_with_key(&token, &key).expect("decode with escaped PEM key");
        assert_eq!(claims.sub, "escaped_pem_user");
        // Garbage PEM falls through (None) rather than panicking.
        assert!(decoding_key_from_pem_env("not-a-pem").is_none());
    }
}
