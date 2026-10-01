//! Capability `attribution`: which link brought a player.
//!
//! The web stores the first tagged landing (utm_* and `ref`) in the
//! `puzzled_attr` cookie after analytics consent, as a query string
//! (`s`, `m`, `c`, `t`, `n`, `r`, `p`, `at`). A Google Ads click id (`g`
//! gclid, `gb` gbraid, `wb` wbraid) is stored there only after marketing
//! consent. This module parses and bounds it; the shell stores the tags on the
//! account at sign-up and sends tags and click id at checkout. The click id is
//! never stored on the account.

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
    /// Google Ads click ids; present only after marketing consent.
    pub gclid: Option<String>,
    pub gbraid: Option<String>,
    pub wbraid: Option<String>,
}

/// A Google Ads click id is 1-100 of letters, digits, `-` and `_`. Anything
/// else is dropped, so a forged cookie cannot smuggle other data into Money.
#[must_use]
pub fn click_id(raw: &str) -> Option<String> {
    let valid = !raw.is_empty()
        && raw.len() <= MAX_VALUE
        && raw
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    valid.then(|| raw.to_string())
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

/// Trim, drop control characters, and cap the length; empty becomes None. A
/// value containing `@` is dropped whole: it is probably an email address.
#[must_use]
pub fn clean_value(raw: &str) -> Option<String> {
    if raw.contains('@') {
        return None;
    }
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
                // Validated on the untruncated value: a long id is dropped, not cut.
                "g" => out.gclid = percent_decode(raw).and_then(|v| click_id(&v)),
                "gb" => out.gbraid = percent_decode(raw).and_then(|v| click_id(&v)),
                "wb" => out.wbraid = percent_decode(raw).and_then(|v| click_id(&v)),
                _ => {}
            }
        }
        (out.has_tag() || out.has_click_id()).then_some(out)
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

    #[must_use]
    pub fn has_click_id(&self) -> bool {
        self.gclid.is_some() || self.gbraid.is_some() || self.wbraid.is_some()
    }

    /// Click ids as they are named in Money checkout metadata (Money has no
    /// `client_reference_id`; `metadata` is copied to the subscription).
    #[must_use]
    pub fn click_id_pairs(&self) -> Vec<(&'static str, &str)> {
        [
            ("gclid", &self.gclid),
            ("gbraid", &self.gbraid),
            ("wbraid", &self.wbraid),
        ]
        .into_iter()
        .filter_map(|(k, v)| v.as_deref().map(|v| (k, v)))
        .collect()
    }

    /// The tags to send at checkout: the account's first-touch tags (or the
    /// landing's, without them) plus the landing's live click id.
    #[must_use]
    pub fn for_checkout(stored: Option<&Self>, landing: Option<&Self>) -> Option<Self> {
        let mut out = stored.or(landing).cloned();
        if let Some(landing) = landing.filter(|l| l.has_click_id()) {
            let base = out.get_or_insert_with(Self::default);
            base.gclid.clone_from(&landing.gclid);
            base.gbraid.clone_from(&landing.gbraid);
            base.wbraid.clone_from(&landing.wbraid);
        }
        out
    }

    /// The Tryit handoff `ref`, when this landing came from Tryit
    /// (`utm_source=tryit`) and the value has the shape Tryit accepts back
    /// (1-64 letters, digits, `-`, `_`). A share link's `ref` carries no
    /// `utm_source=tryit`, so it never counts as a Tryit ref.
    #[must_use]
    pub fn tryit_ref(&self) -> Option<&str> {
        let from_tryit = self
            .source
            .as_deref()
            .is_some_and(|s| s.eq_ignore_ascii_case("tryit"));
        let referral = self.referral.as_deref()?;
        let valid = !referral.is_empty()
            && referral.len() <= 64
            && referral
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
        (from_tryit && valid).then_some(referral)
    }

    /// Tag pairs as they are named in Money checkout metadata and reports.
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
    fn click_ids_are_parsed_and_validated() {
        let found = Attribution::from_cookie("g=Cj0KCQ_abc-123&wb=ok").expect("click id only");
        assert!(!found.has_tag());
        assert_eq!(found.gclid.as_deref(), Some("Cj0KCQ_abc-123"));
        assert_eq!(
            found.click_id_pairs(),
            vec![("gclid", "Cj0KCQ_abc-123"), ("wbraid", "ok")]
        );
        // Spaces, punctuation and over-long values are dropped.
        assert_eq!(Attribution::from_cookie("g=a%20b"), None);
        // A smuggled extra pair is just another (unknown) key, never a value.
        let smuggled = Attribution::from_cookie("g=a%26plan%3Dfree").expect("click id");
        assert_eq!(smuggled.click_id_pairs(), vec![("gclid", "a")]);
        assert_eq!(Attribution::from_cookie("g=a%2Fb"), None);
        assert_eq!(
            Attribution::from_cookie(&format!("g={}", "a".repeat(101))),
            None
        );
        let mixed = Attribution::from_cookie("s=ads&g=%3Cscript%3E").expect("tag");
        assert_eq!(mixed.gclid, None);
    }

    #[test]
    fn checkout_takes_stored_tags_and_the_landing_click_id() {
        let stored = Attribution::from_cookie("s=tryit&r=abc").expect("stored");
        let landing = Attribution::from_cookie("s=ads&g=click1").expect("landing");
        let merged = Attribution::for_checkout(Some(&stored), Some(&landing)).expect("merged");
        assert_eq!(merged.source.as_deref(), Some("tryit"));
        assert_eq!(merged.gclid.as_deref(), Some("click1"));
        // No landing click id: the stored tags go unchanged and carry none.
        let plain = Attribution::from_cookie("s=ads").expect("landing");
        assert_eq!(
            Attribution::for_checkout(Some(&stored), Some(&plain)),
            Some(stored.clone())
        );
        let only = Attribution::from_cookie("g=click2").expect("landing");
        let alone = Attribution::for_checkout(None, Some(&only)).expect("alone");
        assert_eq!(alone.gclid.as_deref(), Some("click2"));
        assert_eq!(Attribution::for_checkout(None, None), None);
    }

    #[test]
    fn only_a_tryit_landing_with_a_well_formed_ref_is_a_tryit_ref() {
        let uuid = "0198a3f2-7c1d-7e2a-9d5b-3c4e5f6a7b8c";
        let tryit = Attribution::from_cookie(&format!("s=tryit&r={uuid}")).expect("tags");
        assert_eq!(tryit.tryit_ref(), Some(uuid));
        // A share link: same `ref` param, no Tryit source.
        let share = Attribution::from_cookie(&format!("r={uuid}&p=%2Fdaily")).expect("tags");
        assert_eq!(share.tryit_ref(), None);
        let other = Attribution::from_cookie(&format!("s=newsletter&r={uuid}")).expect("tags");
        assert_eq!(other.tryit_ref(), None);
        // Tryit source without a ref, or with a ref Tryit would reject.
        assert_eq!(
            Attribution::from_cookie("s=tryit")
                .expect("tags")
                .tryit_ref(),
            None
        );
        let bad = Attribution::from_cookie("s=tryit&r=a%20b").expect("tags");
        assert_eq!(bad.tryit_ref(), None);
        let long =
            Attribution::from_cookie(&format!("s=tryit&r={}", "a".repeat(65))).expect("tags");
        assert_eq!(long.tryit_ref(), None);
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

    #[test]
    fn a_click_id_only_cookie_has_no_tag_so_no_analytics_row_is_written() {
        let found = Attribution::from_cookie("g=abc123").expect("click id");
        assert!(found.has_click_id());
        assert!(!found.has_tag());
        let tagged = Attribution::from_cookie("s=spring&g=abc123").expect("both");
        assert!(tagged.has_tag());
    }

    #[test]
    fn a_value_that_looks_like_an_email_address_is_dropped() {
        assert_eq!(clean_value("someone@example.com"), None);
        assert_eq!(Attribution::from_cookie("s=a%40b.example"), None);
        assert_eq!(clean_value("spring-sale"), Some("spring-sale".to_string()));
    }
}
