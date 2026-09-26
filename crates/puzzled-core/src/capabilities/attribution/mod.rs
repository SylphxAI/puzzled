//! Capability `attribution`: which link brought a player.
//!
//! The web stores the first tagged landing (utm_* and `ref`) in the
//! `puzzled_attr` cookie after analytics consent, as a query string
//! (`s`, `m`, `c`, `t`, `n`, `r`, `p`, `at`). This module parses and bounds
//! it; the shell stores it on the account at sign-up and on the subscription
//! at checkout.

/// Cookie holding the first tagged landing.
pub const ATTRIBUTION_COOKIE: &str = "puzzled_attr";

const MAX_VALUE: usize = 100;

/// A first-touch landing. Every field is optional except that at least one
/// of the tags must be present.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Attribution {
    pub source: Option<String>,
    pub medium: Option<String>,
    pub campaign: Option<String>,
    pub term: Option<String>,
    pub content: Option<String>,
    pub referral: Option<String>,
    pub landing_path: Option<String>,
    /// Landing time, Unix milliseconds.
    pub landed_at_ms: Option<i64>,
}

fn percent_decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' => {
                let hex = raw.get(i + 1..i + 3)?;
                out.push(u8::from_str_radix(hex, 16).ok()?);
                i += 3;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8(out).ok()
}

/// Trim, drop control characters, and cap the length; empty becomes None.
#[must_use]
pub fn clean_value(raw: &str) -> Option<String> {
    let cleaned: String = raw
        .trim()
        .chars()
        .filter(|c| !c.is_control())
        .take(MAX_VALUE)
        .collect();
    let cleaned = cleaned.trim().to_string();
    (!cleaned.is_empty()).then_some(cleaned)
}

impl Attribution {
    /// Parse the cookie value. None when it carries no tag at all.
    #[must_use]
    pub fn from_cookie(value: &str) -> Option<Self> {
        let decoded = percent_decode(value)?;
        let mut out = Self::default();
        for pair in decoded.split('&') {
            let Some((key, raw)) = pair.split_once('=') else {
                continue;
            };
            let value = percent_decode(raw).and_then(|v| clean_value(&v));
            match key {
                "s" => out.source = value,
                "m" => out.medium = value,
                "c" => out.campaign = value,
                "t" => out.term = value,
                "n" => out.content = value,
                "r" => out.referral = value,
                "p" => out.landing_path = value.filter(|p| p.starts_with('/')),
                "at" => out.landed_at_ms = value.and_then(|v| v.parse().ok()),
                _ => {}
            }
        }
        out.has_tag().then_some(out)
    }

    #[must_use]
    pub fn has_tag(&self) -> bool {
        self.source.is_some()
            || self.medium.is_some()
            || self.campaign.is_some()
            || self.term.is_some()
            || self.content.is_some()
            || self.referral.is_some()
    }

    /// Tag pairs as they are named in Stripe metadata and reports.
    #[must_use]
    pub fn metadata_pairs(&self) -> Vec<(&'static str, &str)> {
        [
            ("utm_source", &self.source),
            ("utm_medium", &self.medium),
            ("utm_campaign", &self.campaign),
            ("utm_term", &self.term),
            ("utm_content", &self.content),
            ("ref", &self.referral),
        ]
        .into_iter()
        .filter_map(|(k, v)| v.as_deref().map(|v| (k, v)))
        .collect()
    }
}

/// The attribution cookie from a `Cookie` header value.
#[must_use]
pub fn from_cookie_header(header: &str) -> Option<Attribution> {
    header.split(';').find_map(|pair| {
        let (name, value) = pair.trim().split_once('=')?;
        (name.trim() == ATTRIBUTION_COOKIE)
            .then(|| Attribution::from_cookie(value.trim()))
            .flatten()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_web_cookie() {
        let cookie = "s=tryit&m=referral&c=daily%20launch&r=res_123&p=%2Fdaily&at=1790000000000";
        let found = Attribution::from_cookie(cookie).expect("tags");
        assert_eq!(found.source.as_deref(), Some("tryit"));
        assert_eq!(found.campaign.as_deref(), Some("daily launch"));
        assert_eq!(found.referral.as_deref(), Some("res_123"));
        assert_eq!(found.landing_path.as_deref(), Some("/daily"));
        assert_eq!(found.landed_at_ms, Some(1_790_000_000_000));
        assert_eq!(
            found.metadata_pairs(),
            vec![
                ("utm_source", "tryit"),
                ("utm_medium", "referral"),
                ("utm_campaign", "daily launch"),
                ("ref", "res_123")
            ]
        );
    }

    #[test]
    fn whole_cookie_may_be_url_encoded_and_is_found_in_a_header() {
        let header = "a=1; puzzled_attr=s%3Dtryit%26r%3Dabc; b=2";
        let found = from_cookie_header(header).expect("cookie");
        assert_eq!(found.source.as_deref(), Some("tryit"));
        assert_eq!(found.referral.as_deref(), Some("abc"));
    }

    #[test]
    fn untagged_hostile_or_oversized_values_are_bounded() {
        assert_eq!(Attribution::from_cookie("p=%2Fdaily&at=1"), None);
        assert_eq!(Attribution::from_cookie("s=%20%20"), None);
        let long = "x".repeat(500);
        let found = Attribution::from_cookie(&format!("s={long}&p=https://evil")).expect("tag");
        assert_eq!(found.source.map(|s| s.len()), Some(100));
        assert_eq!(found.landing_path, None);
        assert_eq!(from_cookie_header("other=1"), None);
    }
}
