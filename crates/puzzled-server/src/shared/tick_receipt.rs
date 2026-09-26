//! Copied from SylphxAI/viszy.ai `crates/viszy-api/src/tick_receipt.rs` (viszy#260), the
//! shared pattern for admitting Compute schedule ticks.
//!
//! Admission for Compute's scheduled calls (`[[compute.schedules]]` with
//! `signed = true`): `Authorization: Bearer <compute-tick-receipt+jwt>`, an
//! EdDSA JWT whose `aud` is the exact tick URL, signed by a key Compute
//! publishes at
//! `https://api.compute.sylphx.com/.well-known/compute-tick-receipt-jwks.json`.
//!
//! This replaces the opaque `SYLPHX_CONTROL_EFFECT_TOKEN` bearer, which is
//! retired (cloud access-and-keys) and was never delivered to Puzzled, so every
//! tick answered 503. When Compute's ticks move to Workflows Schedules, this
//! becomes the Workflows invocation token (`Sylphx-Signature`).

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::http::{header, HeaderMap, StatusCode};
use axum::Json;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::Deserialize;

pub const TICK_RECEIPT_TYP: &str = "compute-tick-receipt+jwt";
pub const TICK_RECEIPT_ISSUER: &str = "https://api.compute.sylphx.com";
pub const DEFAULT_JWKS_URL: &str =
    "https://api.compute.sylphx.com/.well-known/compute-tick-receipt-jwks.json";
const CLOCK_SKEW_SECONDS: i64 = 30;
const MAX_TTL_SECONDS: i64 = 900;
const JWKS_FRESH: Duration = Duration::from_secs(3600);
/// A failed refresh keeps admitting with the last good keys this long.
const JWKS_LAST_GOOD: Duration = Duration::from_secs(7 * 24 * 3600);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TickError {
    Missing,
    Invalid,
    Unavailable,
}

impl TickError {
    pub fn response(self) -> (StatusCode, Json<serde_json::Value>) {
        let (status, error) = match self {
            Self::Missing => (StatusCode::UNAUTHORIZED, "tick_receipt_missing"),
            Self::Invalid => (StatusCode::UNAUTHORIZED, "tick_receipt_invalid"),
            Self::Unavailable => (StatusCode::SERVICE_UNAVAILABLE, "tick_receipt_unavailable"),
        };
        (status, Json(serde_json::json!({ "error": error })))
    }
}

#[derive(Deserialize)]
struct Header {
    alg: String,
    typ: String,
    kid: String,
}

#[derive(Deserialize)]
struct Claims {
    #[serde(default)]
    typ: Option<String>,
    iss: String,
    aud: String,
    exp: i64,
    iat: i64,
    #[serde(default)]
    nbf: Option<i64>,
    schedule_id: String,
    tick_id: String,
}

#[derive(Deserialize)]
struct Jwk {
    issuer: String,
    typ: String,
    kty: String,
    crv: String,
    alg: String,
    #[serde(rename = "use")]
    key_use: String,
    kid: String,
    x: String,
    not_before_unix_seconds: i64,
    not_after_unix_seconds: i64,
}

#[derive(Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

#[derive(Clone)]
struct Key {
    verifying: VerifyingKey,
    not_before: i64,
    not_after: i64,
}

/// The published key set, parsed. Every key must be Compute's EdDSA tick key.
#[derive(Clone, Default)]
pub struct KeySet {
    keys: BTreeMap<String, Key>,
}

impl KeySet {
    pub fn from_json(json: &str) -> Result<Self, TickError> {
        let jwks: Jwks = serde_json::from_str(json).map_err(|_| TickError::Invalid)?;
        let mut keys = BTreeMap::new();
        for jwk in jwks.keys {
            if jwk.issuer != TICK_RECEIPT_ISSUER
                || jwk.typ != TICK_RECEIPT_TYP
                || jwk.kty != "OKP"
                || jwk.crv != "Ed25519"
                || jwk.alg != "EdDSA"
                || jwk.key_use != "sig"
            {
                return Err(TickError::Invalid);
            }
            let bytes: [u8; 32] = URL_SAFE_NO_PAD
                .decode(&jwk.x)
                .ok()
                .and_then(|b| b.try_into().ok())
                .ok_or(TickError::Invalid)?;
            let verifying = VerifyingKey::from_bytes(&bytes).map_err(|_| TickError::Invalid)?;
            keys.insert(
                jwk.kid,
                Key {
                    verifying,
                    not_before: jwk.not_before_unix_seconds,
                    not_after: jwk.not_after_unix_seconds,
                },
            );
        }
        if keys.is_empty() {
            return Err(TickError::Invalid);
        }
        Ok(Self { keys })
    }

    fn knows(&self, token: &str) -> bool {
        token
            .split('.')
            .next()
            .and_then(|h| decode::<Header>(h).ok())
            .is_some_and(|h| self.keys.contains_key(&h.kid))
    }

    /// Signature, key window, claims, and the exact audience.
    pub fn verify(&self, token: &str, audience: &str, now: i64) -> Result<(), TickError> {
        let mut parts = token.split('.');
        let (Some(h), Some(p), Some(s), None) =
            (parts.next(), parts.next(), parts.next(), parts.next())
        else {
            return Err(TickError::Invalid);
        };
        let header: Header = decode(h)?;
        if header.alg != "EdDSA" || header.typ != TICK_RECEIPT_TYP {
            return Err(TickError::Invalid);
        }
        let key = self.keys.get(&header.kid).ok_or(TickError::Invalid)?;
        if now + CLOCK_SKEW_SECONDS < key.not_before || now - CLOCK_SKEW_SECONDS >= key.not_after {
            return Err(TickError::Invalid);
        }
        let signature = URL_SAFE_NO_PAD
            .decode(s)
            .ok()
            .and_then(|b| Signature::from_slice(&b).ok())
            .ok_or(TickError::Invalid)?;
        key.verifying
            .verify(format!("{h}.{p}").as_bytes(), &signature)
            .map_err(|_| TickError::Invalid)?;
        let claims: Claims = decode(p)?;
        let typ_ok = claims.typ.as_deref().is_none_or(|t| t == TICK_RECEIPT_TYP);
        let fresh = claims.exp > now - CLOCK_SKEW_SECONDS
            && claims.exp > claims.iat
            && claims.exp - claims.iat <= MAX_TTL_SECONDS
            && claims.iat <= now + CLOCK_SKEW_SECONDS
            && claims.nbf.is_none_or(|nbf| nbf <= now + CLOCK_SKEW_SECONDS);
        if !typ_ok
            || claims.iss != TICK_RECEIPT_ISSUER
            || claims.aud != audience
            || claims.schedule_id.trim().is_empty()
            || claims.tick_id.trim().is_empty()
            || !fresh
        {
            return Err(TickError::Invalid);
        }
        Ok(())
    }
}

fn decode<T: serde::de::DeserializeOwned>(segment: &str) -> Result<T, TickError> {
    let bytes = URL_SAFE_NO_PAD
        .decode(segment)
        .map_err(|_| TickError::Invalid)?;
    serde_json::from_slice(&bytes).map_err(|_| TickError::Invalid)
}

/// The exact tick URL Compute signs: `https://{Host}{path}`.
pub fn audience(headers: &HeaderMap, path: &str) -> Option<String> {
    let host = headers
        .get(header::HOST)
        .or_else(|| headers.get("x-forwarded-host"))
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|h| !h.is_empty())?;
    Some(format!("https://{host}{path}"))
}

struct Cached {
    keys: KeySet,
    fetched: Instant,
}

/// Verifies tick receipts against Compute's JWKS: fetched lazily, fresh for an
/// hour, refreshed early when a token names an unknown key, and kept as the
/// last good set for a week when a refresh fails.
#[derive(Clone)]
pub struct TickVerifier {
    http: reqwest::Client,
    jwks_url: String,
    cache: Arc<Mutex<Option<Cached>>>,
}

impl Default for TickVerifier {
    fn default() -> Self {
        Self::new(DEFAULT_JWKS_URL.to_string())
    }
}

impl TickVerifier {
    #[must_use]
    pub fn new(jwks_url: String) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
            jwks_url,
            cache: Arc::default(),
        }
    }

    /// `COMPUTE_TICK_RECEIPT_JWKS_URL`, else Compute's published key set.
    #[must_use]
    pub fn from_env() -> Self {
        Self::new(
            std::env::var("COMPUTE_TICK_RECEIPT_JWKS_URL")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_JWKS_URL.to_string()),
        )
    }

    /// Tests: a verifier that already holds this key set.
    #[cfg(test)]
    #[must_use]
    pub fn with_keys(keys: KeySet) -> Self {
        let verifier = Self::new("http://127.0.0.1:9/unused".into());
        if let Ok(mut cache) = verifier.cache.lock() {
            *cache = Some(Cached {
                keys,
                fetched: Instant::now(),
            });
        }
        verifier
    }

    async fn fetch(&self) -> Option<KeySet> {
        let body = self.http.get(&self.jwks_url).send().await.ok()?;
        if !body.status().is_success() {
            return None;
        }
        KeySet::from_json(&body.text().await.ok()?).ok()
    }

    async fn keys(&self, token: &str) -> Option<KeySet> {
        let cached = self
            .cache
            .lock()
            .ok()
            .and_then(|c| c.as_ref().map(|c| (c.keys.clone(), c.fetched.elapsed())));
        if let Some((keys, age)) = &cached {
            if *age < JWKS_FRESH && keys.knows(token) {
                return Some(keys.clone());
            }
        }
        match self.fetch().await {
            Some(keys) => {
                if let Ok(mut cache) = self.cache.lock() {
                    *cache = Some(Cached {
                        keys: keys.clone(),
                        fetched: Instant::now(),
                    });
                }
                Some(keys)
            }
            None => cached
                .filter(|(_, age)| *age < JWKS_LAST_GOOD)
                .map(|(keys, _)| keys),
        }
    }

    /// Admit one scheduled call to `path`.
    pub async fn admit(&self, headers: &HeaderMap, path: &str) -> Result<(), TickError> {
        let token = headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .ok_or(TickError::Missing)?;
        let audience = audience(headers, path).ok_or(TickError::Invalid)?;
        let keys = self.keys(token).await.ok_or(TickError::Unavailable)?;
        keys.verify(token, &audience, chrono::Utc::now().timestamp())
    }
}

#[cfg(test)]
pub(crate) mod test_signing {
    //! Mint receipts the way Compute does, for tests.
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    pub fn key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    pub fn jwks(key: &SigningKey) -> String {
        serde_json::json!({ "keys": [{
            "issuer": TICK_RECEIPT_ISSUER, "typ": TICK_RECEIPT_TYP, "kty": "OKP",
            "crv": "Ed25519", "alg": "EdDSA", "use": "sig", "kid": "compute-tick-1",
            "x": URL_SAFE_NO_PAD.encode(key.verifying_key().to_bytes()),
            "not_before_unix_seconds": 0, "not_after_unix_seconds": 4_102_444_800i64
        }]})
        .to_string()
    }

    pub fn mint(key: &SigningKey, aud: &str, iat: i64) -> String {
        let h = URL_SAFE_NO_PAD.encode(
            serde_json::json!({"alg": "EdDSA", "typ": TICK_RECEIPT_TYP, "kid": "compute-tick-1"})
                .to_string(),
        );
        let p = URL_SAFE_NO_PAD.encode(
            serde_json::json!({
                "iss": TICK_RECEIPT_ISSUER, "aud": aud, "schedule_id": "viszy-account-purge",
                "intended_at": "2026-09-26T16:17:00Z", "tick_id": "tick_1", "jti": "j1",
                "iat": iat, "exp": iat + 300
            })
            .to_string(),
        );
        let s = URL_SAFE_NO_PAD.encode(key.sign(format!("{h}.{p}").as_bytes()).to_bytes());
        format!("{h}.{p}.{s}")
    }
}

#[cfg(test)]
mod tests {
    use super::test_signing::{jwks, key, mint};
    use super::*;

    const AUD: &str = "https://viszy.ai/internal/compute/account-purge";

    #[test]
    fn a_receipt_for_this_url_is_admitted() {
        let k = key();
        let set = KeySet::from_json(&jwks(&k)).unwrap();
        let now = 1_790_000_000;
        assert_eq!(set.verify(&mint(&k, AUD, now), AUD, now + 10), Ok(()));
    }

    #[test]
    fn another_url_an_old_receipt_or_a_forged_one_is_refused() {
        let k = key();
        let set = KeySet::from_json(&jwks(&k)).unwrap();
        let now = 1_790_000_000;
        let token = mint(&k, AUD, now);
        assert_eq!(
            set.verify(&token, "https://viszy.ai/internal/compute/quota-sweep", now),
            Err(TickError::Invalid)
        );
        assert_eq!(set.verify(&token, AUD, now + 400), Err(TickError::Invalid));
        let other = ed25519_dalek::SigningKey::from_bytes(&[9u8; 32]);
        assert_eq!(
            set.verify(&mint(&other, AUD, now), AUD, now),
            Err(TickError::Invalid)
        );
        assert_eq!(
            set.verify("effect-token", AUD, now),
            Err(TickError::Invalid)
        );
    }

    #[test]
    fn the_audience_is_the_exact_tick_url() {
        let mut headers = HeaderMap::new();
        headers.insert(header::HOST, "viszy.ai".parse().unwrap());
        assert_eq!(
            audience(&headers, "/internal/compute/account-purge").as_deref(),
            Some(AUD)
        );
    }
}
