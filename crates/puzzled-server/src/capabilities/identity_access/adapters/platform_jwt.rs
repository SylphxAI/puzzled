//! Platform RS256 / JWKS identity verification for puzzled-server.
#![allow(clippy::expect_used)]
//!
//! Caller-supplied `x-user-id` is never trusted as identity. Protected routes
//! must present a Bearer JWT whose signature verifies against Platform JWKS
//! (production has no pinned-key override). `sub` is the only accepted user id.
//!
//! JWKS is fetched off the request path: [`spawn_jwks_refresher`] runs one
//! async task that loads the key set at startup, refreshes it every
//! `JWKS_CACHE_TTL`, and refetches early (rate-limited) when a token names an
//! unknown `kid`. Verification only reads an `Arc` snapshot, so no lock is held
//! across network I/O and no tokio worker blocks.

use std::collections::HashMap;
use std::sync::{Arc, OnceLock, RwLock};
use std::time::Duration;

use axum::http::{header, HeaderMap, StatusCode};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

const DEFAULT_JWKS_URL: &str = "https://api.sylphx.com/.well-known/jwks.json";
const JWKS_CACHE_TTL: Duration = Duration::from_secs(300);
/// Floor between two fetches, so unknown-`kid` tokens cannot drive a fetch per request.
const JWKS_MIN_REFRESH_INTERVAL: Duration = Duration::from_secs(10);
const JWKS_FETCH_TIMEOUT: Duration = Duration::from_secs(5);
const JWKS_MAX_RETRY_BACKOFF: Duration = Duration::from_secs(60);

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
    keys: HashMap<String, DecodingKey>,
    /// keys without kid
    unkeyed: Vec<DecodingKey>,
}

/// Last good key set. The lock is held only to clone or swap the `Arc`.
static JWKS_CACHE: RwLock<Option<Arc<JwksCache>>> = RwLock::new(None);
/// Wakes the refresher early (unknown `kid`, empty cache). Permits coalesce.
static JWKS_REFRESH: OnceLock<tokio::sync::Notify> = OnceLock::new();

fn jwks_refresh_signal() -> &'static tokio::sync::Notify {
    JWKS_REFRESH.get_or_init(tokio::sync::Notify::new)
}

fn jwks_snapshot() -> Option<Arc<JwksCache>> {
    JWKS_CACHE
        .read()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .clone()
}

fn store_jwks(cache: JwksCache) {
    *JWKS_CACHE
        .write()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(Arc::new(cache));
}

/// Ask the refresher for an early fetch; never blocks and never fetches inline.
fn request_jwks_refresh() {
    jwks_refresh_signal().notify_one();
}

#[cfg(test)]
fn clear_jwks_for_test() {
    *JWKS_CACHE
        .write()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = None;
}

#[cfg(test)]
static TEST_DECODING_KEY_PEM: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// Shared lock so tests that install/clear the process-local test key do not
/// race with each other (used by lib tests and this module's tests).
#[cfg(test)]
pub fn test_key_lock() -> &'static std::sync::Mutex<()> {
    static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    &LOCK
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
///
/// Compiled only under `cfg(test)`: a release binary has no override that
/// verification would consult before the Platform key set.
#[cfg(test)]
pub fn install_test_decoding_key_pem(pem: &str) -> Result<(), String> {
    // Validate PEM shape early.
    let _ = DecodingKey::from_rsa_pem(pem.as_bytes()).map_err(|e| e.to_string())?;
    *TEST_DECODING_KEY_PEM
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(pem.to_string());
    Ok(())
}

#[cfg(test)]
pub fn clear_test_decoding_key() {
    *TEST_DECODING_KEY_PEM
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = None;
}

#[cfg(test)]
fn test_decoding_key() -> Option<DecodingKey> {
    let pem = TEST_DECODING_KEY_PEM
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .clone()?;
    DecodingKey::from_rsa_pem(pem.as_bytes()).ok()
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
    // Exactly RS256: `none` and HS* (public key as HMAC secret) are refused.
    let mut v = Validation::new(Algorithm::RS256);
    v.algorithms = vec![Algorithm::RS256];
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

async fn fetch_jwks(client: &reqwest::Client, url: &str) -> Result<JwksCache, JwtError> {
    let doc: JwksDocument = client
        .get(url)
        .send()
        .await
        .map_err(|e| JwtError::JwksUnavailable(e.to_string()))?
        .error_for_status()
        .map_err(|e| JwtError::JwksUnavailable(e.to_string()))?
        .json()
        .await
        .map_err(|e| JwtError::JwksUnavailable(e.to_string()))?;
    jwks_cache_from_document(doc)
}

fn jwks_cache_from_document(doc: JwksDocument) -> Result<JwksCache, JwtError> {
    let mut keys = HashMap::new();
    let mut unkeyed = Vec::new();
    for jwk in doc.keys {
        // Only RSA keys that declare RS256 (or no alg) are accepted; verification
        // is pinned to RS256, so any other declared alg would never verify.
        if jwk.kty != "RSA" || jwk.alg.as_deref().is_some_and(|a| a != "RS256") {
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
    Ok(JwksCache { keys, unkeyed })
}

/// Start the JWKS refresher on the current tokio runtime.
///
/// Returns `None` only if the HTTP client cannot be built. Call once from the
/// composition root. The first fetch starts immediately; later ones
/// run every `JWKS_CACHE_TTL`, on an early-refresh request (no sooner than
/// `JWKS_MIN_REFRESH_INTERVAL` after the last fetch), or on retry backoff after
/// a failure. The last good key set keeps serving while a refresh fails.
pub fn spawn_jwks_refresher() -> Option<tokio::task::JoinHandle<()>> {
    let client = match reqwest::Client::builder()
        .timeout(JWKS_FETCH_TIMEOUT)
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            tracing::error!(%error, "jwks client build failed; Bearer verification will return 503");
            return None;
        }
    };
    let url = jwks_url();
    Some(tokio::spawn(async move {
        let signal = jwks_refresh_signal();
        let mut failures: u32 = 0;
        loop {
            let wait = match fetch_jwks(&client, &url).await {
                Ok(cache) => {
                    store_jwks(cache);
                    failures = 0;
                    JWKS_CACHE_TTL
                }
                Err(error) => {
                    failures = failures.saturating_add(1);
                    tracing::warn!(
                        ?error,
                        failures,
                        "jwks refresh failed; keeping last good key set"
                    );
                    JWKS_MIN_REFRESH_INTERVAL
                        .saturating_mul(failures)
                        .min(JWKS_MAX_RETRY_BACKOFF)
                }
            };
            tokio::time::sleep(JWKS_MIN_REFRESH_INTERVAL.min(wait)).await;
            tokio::select! {
                () = tokio::time::sleep(wait.saturating_sub(JWKS_MIN_REFRESH_INTERVAL)) => {}
                () = signal.notified() => {}
            }
        }
    }))
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

    // Unit-test override key first (compiled into test builds only).
    #[cfg(test)]
    if let Some(key) = test_decoding_key() {
        let claims = decode_with_key(token, &key)?;
        return Ok(VerifiedIdentity {
            user_id: claims.sub.trim().to_string(),
            display_name: claims.name.clone(),
            email: claims.email.clone(),
            is_admin: is_admin_from_claims(&claims),
        });
    }

    let Some(cache) = jwks_snapshot() else {
        request_jwks_refresh();
        return Err(JwtError::JwksUnavailable("jwks not loaded yet".into()));
    };

    let mut last_err = JwtError::VerificationFailed("no keys tried".into());
    if let Some(kid) = header_kid(token) {
        if !cache.keys.contains_key(&kid) {
            // Possible key rotation: fetch early in the background.
            request_jwks_refresh();
        }
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
    fn unloaded_jwks_fails_closed_without_fetching_inline() {
        let _g = lock();
        clear_test_decoding_key();
        clear_jwks_for_test();
        let token = {
            let claims = MintClaims {
                sub: "cold_start".into(),
                name: "Cold".into(),
                exp: chrono::Utc::now().timestamp() + 3600,
                scope: None,
            };
            let enc = EncodingKey::from_rsa_pem(TEST_PRIV_PEM.as_bytes()).expect("enc");
            encode(&JwtHeader::new(Algorithm::RS256), &claims, &enc).expect("mint")
        };
        let err = verify_platform_jwt(&token).unwrap_err();
        assert!(matches!(err, JwtError::JwksUnavailable(_)), "got {err:?}");
        assert_eq!(err.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[test]
    fn jwks_document_without_rsa_keys_is_rejected() {
        let doc: JwksDocument =
            serde_json::from_value(serde_json::json!({ "keys": [{ "kty": "EC", "kid": "k1" }] }))
                .expect("doc");
        assert!(matches!(
            jwks_cache_from_document(doc),
            Err(JwtError::JwksUnavailable(_))
        ));
    }

    #[test]
    fn rejects_garbage_token() {
        let _g = lock();
        install_test_decoding_key_pem(TEST_PUB_PEM).expect("install key");
        let err = verify_platform_jwt("not-a-jwt").unwrap_err();
        assert_eq!(err, JwtError::MalformedToken);
        clear_test_decoding_key();
    }

    const TEST_N: &str = "nHAYL32Ej3o2Ub7lyRntvTpe-rQi9GgfznwVv5MY5xawWwyEzfNPoPbcEO_RZ4tAloF-F0ZYq_LZzlSQdNeR4r3pkJUS9kl-3DF6D8dzzBcOpLx2g70Arw2gtL5qIPF43v8RsAlnjgacpwwDv_vzTb8K0dgNMbmdacduabkEVXuDj5zn6AVi_RmB5LcK5KyXxoNW0Lf1Day2St8gOZj_pH0MYE37Eaa105fYPmO8h-fV2yg00pbss1K1PvTbwspfS4AZD9vdleyXKFoBXHciM4vXgHn5GlFZJ1V5A_kVFc74xsWNHAH-M8tHR2u4-yxCYg4efdcWi68SAqqYUkfKIQ";

    fn test_jwks(kid: &str, alg: Option<&str>) -> JwksDocument {
        let mut key = serde_json::json!({"kty": "RSA", "kid": kid, "n": TEST_N, "e": "AQAB"});
        if let Some(alg) = alg {
            key["alg"] = alg.into();
        }
        serde_json::from_value(serde_json::json!({ "keys": [key] })).expect("jwks doc")
    }

    fn mint_with_kid(kid: &str, sub: &str) -> String {
        let claims = MintClaims {
            sub: sub.into(),
            name: "Jwks".into(),
            exp: chrono::Utc::now().timestamp() + 3600,
            scope: None,
        };
        let mut header = JwtHeader::new(Algorithm::RS256);
        header.kid = Some(kid.into());
        let enc = EncodingKey::from_rsa_pem(TEST_PRIV_PEM.as_bytes()).expect("enc");
        encode(&header, &claims, &enc).expect("mint")
    }

    /// Consume any pending early-refresh permit so a test starts from "none requested".
    fn refresh_requested() -> bool {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .expect("rt");
        rt.block_on(async {
            tokio::time::timeout(Duration::from_millis(20), jwks_refresh_signal().notified())
                .await
                .is_ok()
        })
    }

    #[test]
    fn token_verifies_against_jwks_key() {
        let _g = lock();
        clear_test_decoding_key();
        store_jwks(jwks_cache_from_document(test_jwks("k1", Some("RS256"))).expect("cache"));
        let _ = refresh_requested();
        let id = verify_platform_jwt(&mint_with_kid("k1", "jwks_user")).expect("verified");
        assert_eq!(id.user_id, "jwks_user");
        assert!(!refresh_requested(), "known kid must not trigger a refetch");
        clear_jwks_for_test();
    }

    #[test]
    fn unknown_kid_requests_one_refetch() {
        let _g = lock();
        clear_test_decoding_key();
        store_jwks(jwks_cache_from_document(test_jwks("k1", None)).expect("cache"));
        let _ = refresh_requested();
        // Verifies via the fallback key scan, but the rotation signal must fire once.
        let _ = verify_platform_jwt(&mint_with_kid("rotated", "u"));
        let _ = verify_platform_jwt(&mint_with_kid("rotated", "u"));
        assert!(refresh_requested(), "unknown kid must request a refetch");
        assert!(!refresh_requested(), "requests coalesce into one permit");
        clear_jwks_for_test();
    }

    #[test]
    fn fetch_jwks_reads_document_over_http() {
        let _g = lock();
        let body = serde_json::json!({"keys": [{"kty":"RSA","kid":"k1","n":TEST_N,"e":"AQAB"}]})
            .to_string();
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("rt");
        let cache = rt.block_on(async {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind");
            let addr = listener.local_addr().expect("addr");
            tokio::spawn(async move {
                let (mut sock, _) = listener.accept().await.expect("accept");
                let mut buf = [0u8; 1024];
                let _ = sock.read(&mut buf).await;
                let resp = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                sock.write_all(resp.as_bytes()).await.expect("write");
            });
            fetch_jwks(&reqwest::Client::new(), &format!("http://{addr}/jwks.json"))
                .await
                .expect("fetch")
        });
        assert!(cache.keys.contains_key("k1"));
    }

    #[test]
    fn jwk_declaring_other_algorithm_is_skipped() {
        assert!(matches!(
            jwks_cache_from_document(test_jwks("k1", Some("RS512"))),
            Err(JwtError::JwksUnavailable(_))
        ));
    }

    #[test]
    fn env_pinned_key_is_ignored_in_production_path() {
        let _g = lock();
        clear_test_decoding_key();
        clear_jwks_for_test();
        // SAFETY-free on edition 2021; guarded by the shared test lock.
        std::env::set_var("PLATFORM_JWT_PUBLIC_KEY_PEM", TEST_PUB_PEM);
        // A token signed by the env-pinned key must NOT verify without JWKS.
        let token = mint_with_kid("k1", "pinned_attacker");
        let err = verify_platform_jwt(&token).unwrap_err();
        assert!(matches!(err, JwtError::JwksUnavailable(_)), "got {err:?}");
        // And with a JWKS holding a different key it must fail too.
        let other = serde_json::from_value(serde_json::json!({"keys": [{
            "kty":"RSA","kid":"k1","e":"AQAB",
            "n":"qN9GfKa3xA32VKRG51lgzYMrRaqWVekUl_KG24NBoE5bWNtLx9XMfIHfpDXsEoiAhx8ZVosziI3U3Cp2CNKWXxF4qm0o6CsMpbEeeHEJ9qrbh_NvKTfomRHUjAk3s9V7LikBP-8iXOJ03fN281t2T3AtOLt26XjhPIbT3MFzGiLiPanylAmF7H78emfbBVNuCtpOAcwTljC4K3iP90SHEDkBTcMbYxps83a45tGefz5R-8sv6n5gCWlo98QgDVefd_B_IzMMzWikBmJqVmsJ7IdMcnJEbvxsDxg_WqdNVzhCAG2BSo9wsp5SPZNKq4s7d8-i-tafBSTbBKJi4Qwk3w"
        }]})).expect("doc");
        store_jwks(jwks_cache_from_document(other).expect("cache"));
        assert!(verify_platform_jwt(&token).is_err());
        std::env::remove_var("PLATFORM_JWT_PUBLIC_KEY_PEM");
        clear_jwks_for_test();
    }

    #[test]
    fn algorithm_confusion_is_refused() {
        use base64::Engine as _;
        let _g = lock();
        clear_test_decoding_key();
        store_jwks(jwks_cache_from_document(test_jwks("k1", None)).expect("cache"));
        let exp = chrono::Utc::now().timestamp() + 3600;
        let b64 = |v: serde_json::Value| {
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(v.to_string())
        };
        // alg=none, unsigned.
        let none = format!(
            "{}.{}.",
            b64(serde_json::json!({"alg":"none","typ":"JWT","kid":"k1"})),
            b64(serde_json::json!({"sub":"evil","exp":exp}))
        );
        assert!(verify_platform_jwt(&none).is_err(), "alg=none accepted");
        // HS256 signed with the public key PEM as the HMAC secret.
        let mut header = JwtHeader::new(Algorithm::HS256);
        header.kid = Some("k1".into());
        let hs = encode(
            &header,
            &serde_json::json!({"sub":"evil","exp":exp}),
            &EncodingKey::from_secret(TEST_PUB_PEM.as_bytes()),
        )
        .expect("mint hs256");
        assert!(
            verify_platform_jwt(&hs).is_err(),
            "HS256 with public key accepted"
        );
        clear_jwks_for_test();
    }
}
