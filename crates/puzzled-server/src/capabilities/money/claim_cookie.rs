//! HttpOnly cookie retaining single-use guest checkout `claim_secret` values
//! across the browser redirect to Stripe Checkout and back to Tryit.
//!
//! Security invariants:
//! - `claim_secret` stays strictly in an `HttpOnly; SameSite=Lax; Path=/` cookie
//!   (`Secure` on HTTPS origins). It is never placed in URLs, query parameters,
//!   response bodies, analytics payloads, or logs.
//! - `Debug` on `ClaimCookieEntry` redacts `sec` so diagnostic formatting cannot
//!   leak a claim secret.

use axum::http::header::COOKIE;
use axum::http::HeaderMap;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use serde::{Deserialize, Serialize};

/// Browser cookie name (paired with `puzzled_session` in Next.js SSR forwarding).
pub const CHECKOUT_CLAIM_COOKIE: &str = "puzzled_checkout_claim";
/// Money guest `claim_secret` lifetime (7 days).
pub const CLAIM_COOKIE_MAX_AGE_SECS: u32 = 604_800;
/// Bounded ring buffer so switching plans on Stripe does not drop an earlier attempt.
const MAX_CLAIM_ENTRIES: usize = 4;
const MAX_COOKIE_VALUE_LEN: usize = 4096;

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClaimCookieEntry {
    /// Processor checkout session id (`cs_...`).
    #[serde(default)]
    pub s: String,
    /// Money checkout session resource id (`chk_...`).
    #[serde(default)]
    pub chk: String,
    /// Single-use cryptographic `claim_secret` (`clm_...`).
    pub sec: String,
    /// Plan id (`individual_yearly`, ...) for consent audit recording on claim.
    #[serde(default)]
    pub plan: String,
    /// Catalogue price key (`plus_individual_yearly`, ...).
    #[serde(default)]
    pub price: String,
    /// Buyer locale segment (`en-US`, `ja`, ...).
    #[serde(default)]
    pub loc: String,
}

impl std::fmt::Debug for ClaimCookieEntry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClaimCookieEntry")
            .field("s", &self.s)
            .field("chk", &self.chk)
            .field("sec", &"[redacted]")
            .field("plan", &self.plan)
            .field("price", &self.price)
            .field("loc", &self.loc)
            .finish()
    }
}

impl ClaimCookieEntry {
    /// Preferred lookup id for Money `:claim` (`cs_...` when present, else `chk_...`).
    #[must_use]
    pub fn lookup_id(&self) -> &str {
        if !self.s.is_empty() {
            &self.s
        } else {
            &self.chk
        }
    }

    #[must_use]
    pub fn matches_id(&self, id: &str) -> bool {
        let trimmed = id.trim();
        !trimmed.is_empty() && (self.s == trimmed || self.chk == trimmed)
    }

    fn valid(&self) -> bool {
        let has_id = !self.s.is_empty() || !self.chk.is_empty();
        has_id
            && self.s.len() <= 128
            && self.chk.len() <= 128
            && self.sec.starts_with("clm_")
            && self.sec.len() <= 200
            && !self.sec.chars().any(char::is_control)
    }
}

/// Read valid retained guest checkout entries from request `Cookie` headers.
#[must_use]
pub fn read_entries(headers: &HeaderMap) -> Vec<ClaimCookieEntry> {
    let raw = headers
        .get_all(COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|header| header.split(';'))
        .find_map(|pair| {
            let (name, val) = pair.trim().split_once('=')?;
            let val = val.trim();
            (name.trim() == CHECKOUT_CLAIM_COOKIE
                && !val.is_empty()
                && val.len() <= MAX_COOKIE_VALUE_LEN)
                .then_some(val)
        });
    let Some(encoded) = raw else {
        return Vec::new();
    };
    let Ok(bytes) = URL_SAFE_NO_PAD.decode(encoded) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_slice::<Vec<ClaimCookieEntry>>(&bytes) else {
        return Vec::new();
    };
    parsed
        .into_iter()
        .filter(ClaimCookieEntry::valid)
        .take(MAX_CLAIM_ENTRIES)
        .collect()
}

/// Append a newly minted guest checkout entry, replacing any duplicate id and bounding size.
#[must_use]
pub fn append_entry(
    mut existing: Vec<ClaimCookieEntry>,
    entry: ClaimCookieEntry,
) -> Vec<ClaimCookieEntry> {
    if !entry.valid() {
        return existing;
    }
    existing.retain(|item| {
        (entry.s.is_empty() || item.s != entry.s) && (entry.chk.is_empty() || item.chk != entry.chk)
    });
    existing.push(entry);
    if existing.len() > MAX_CLAIM_ENTRIES {
        let drop_count = existing.len() - MAX_CLAIM_ENTRIES;
        existing.drain(0..drop_count);
    }
    existing
}

#[must_use]
pub fn find_entry<'a>(
    entries: &'a [ClaimCookieEntry],
    checkout_session_id: &str,
) -> Option<&'a ClaimCookieEntry> {
    entries
        .iter()
        .find(|entry| entry.matches_id(checkout_session_id))
}

#[must_use]
pub fn remove_entry(
    mut entries: Vec<ClaimCookieEntry>,
    checkout_session_id: &str,
) -> Vec<ClaimCookieEntry> {
    entries.retain(|entry| !entry.matches_id(checkout_session_id));
    entries
}

/// Format an `HttpOnly; SameSite=Lax; Path=/` `Set-Cookie` header value (deleting when empty).
pub fn format_set_cookie(entries: &[ClaimCookieEntry], secure: bool) -> Result<String, String> {
    let secure_attr = if secure { "; Secure" } else { "" };
    if entries.is_empty() {
        return Ok(format!(
            "{CHECKOUT_CLAIM_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{secure_attr}"
        ));
    }
    let json = serde_json::to_vec(entries).map_err(|e| e.to_string())?;
    let encoded = URL_SAFE_NO_PAD.encode(json);
    Ok(format!(
        "{CHECKOUT_CLAIM_COOKIE}={encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age={CLAIM_COOKIE_MAX_AGE_SECS}{secure_attr}"
    ))
}
