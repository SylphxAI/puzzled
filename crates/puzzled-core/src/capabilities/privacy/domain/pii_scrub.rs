//! Pure PII scrub residual —
//! dual-oracle of `packages/sdk/src/lib/monitoring/error-tracking/pii-scrubber.ts`
//! high-precision string redaction half.
//!
//! Sentry transport I/O remains FE residual.
//! NO authority_rust / ts_deleted invent.

/// Replacement tokens (TS scrubber replacements).
pub const REPL_EMAIL: &str = "[EMAIL]";
pub const REPL_CREDIT_CARD: &str = "[CREDIT_CARD]";
pub const REPL_SSN: &str = "[SSN]";
pub const REPL_PHONE: &str = "[PHONE]";
pub const REPL_IP: &str = "[IP_ADDRESS]";
pub const REPL_API_KEY: &str = "[API_KEY]";
pub const REPL_BEARER: &str = "Bearer [TOKEN]";
pub const REPL_JWT: &str = "[JWT_TOKEN]";

/// Detect simple email (dual-oracle of email pattern intent; not full RFC).
#[must_use]
pub fn looks_like_email(token: &str) -> bool {
    let b = token.as_bytes();
    if b.len() < 5 {
        return false;
    }
    let Some(at) = token.find('@') else {
        return false;
    };
    if at == 0 || at + 1 >= token.len() {
        return false;
    }
    let domain = &token[at + 1..];
    domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
}

/// Detect 15–16 digit card-like runs (spaces/dashes optional).
#[must_use]
pub fn looks_like_credit_card(s: &str) -> bool {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    (15..=16).contains(&digits.len()) && digits.chars().all(|c| c.is_ascii_digit())
}

/// Detect US SSN shape `###-##-####` or spaced.
#[must_use]
pub fn looks_like_ssn(s: &str) -> bool {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    digits.len() == 9 && (s.contains('-') || s.contains(' ') || s.len() == 9)
}

/// Detect IPv4.
#[must_use]
pub fn looks_like_ipv4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    parts.iter().all(|p| {
        if p.is_empty() || (p.len() > 1 && p.starts_with('0')) {
            return false;
        }
        p.parse::<u8>().is_ok()
    })
}

/// Detect JWT-like three segments starting with eyJ.
#[must_use]
pub fn looks_like_jwt(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 3
        && parts[0].starts_with("eyJ")
        && parts[1].starts_with("eyJ")
        && !parts[2].is_empty()
}

/// Scrub a free-text message using dual-oracle replacements (word-level + URL password).
#[must_use]
pub fn scrub_pii_text(input: &str) -> String {
    let mut out = input.to_string();

    // JWT first (specific)
    out = scrub_tokens(&out, looks_like_jwt, REPL_JWT);

    // emails
    out = scrub_tokens(&out, looks_like_email, REPL_EMAIL);

    // IPv4
    out = scrub_tokens(&out, looks_like_ipv4, REPL_IP);

    // Bearer tokens
    if let Some(idx) = out.find("Bearer ") {
        let rest = &out[idx + "Bearer ".len()..];
        let token = rest.split_whitespace().next().unwrap_or("");
        if token.len() >= 20 {
            out = out.replacen(&format!("Bearer {token}"), REPL_BEARER, 1);
        }
    }

    // password in URL user:pass@
    if let Some(scheme_end) = out.find("://") {
        let after = &out[scheme_end + 3..];
        if let Some(at) = after.find('@') {
            let creds = &after[..at];
            if creds.contains(':') {
                let host_start = scheme_end + 3 + at;
                let redacted = format!("{}://***:***{}", &out[..scheme_end], &out[host_start..]);
                out = redacted;
            }
        }
    }

    // SSN-like and cards (digit heavy tokens)
    out = scrub_tokens(
        &out,
        |t| looks_like_ssn(t) && (t.contains('-') || t.contains(' ')),
        REPL_SSN,
    );
    out = scrub_tokens(
        &out,
        |t| {
            let compact: String = t
                .chars()
                .filter(|c| c.is_ascii_digit() || *c == '-' || *c == ' ')
                .collect();
            looks_like_credit_card(&compact) && t.chars().any(|c| c.is_ascii_digit())
        },
        REPL_CREDIT_CARD,
    );

    out
}

fn scrub_tokens(input: &str, pred: impl Fn(&str) -> bool, repl: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for (i, part) in input.split_whitespace().enumerate() {
        if i > 0 {
            out.push(' ');
        }
        // strip common trailing punctuation for match
        let (core, trail) = trim_trail_punct(part);
        if pred(core) {
            out.push_str(repl);
            out.push_str(trail);
        } else {
            out.push_str(part);
        }
    }
    out
}

fn trim_trail_punct(s: &str) -> (&str, &str) {
    let bytes = s.as_bytes();
    let mut end = bytes.len();
    while end > 0 && matches!(bytes[end - 1], b',' | b'.' | b';' | b':' | b'!' | b'?') {
        end -= 1;
    }
    (&s[..end], &s[end..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pii_scrub_dual_oracle() {
        assert!(looks_like_email("user@example.com"));
        assert!(!looks_like_email("not-an-email"));
        assert!(looks_like_ipv4("192.168.0.1"));
        assert!(looks_like_jwt(
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature"
        ));
        assert!(looks_like_ssn("123-45-6789"));
        assert!(looks_like_credit_card("4111111111111111"));

        let scrubbed = scrub_pii_text("contact user@example.com from 10.0.0.1");
        assert!(scrubbed.contains(REPL_EMAIL));
        assert!(scrubbed.contains(REPL_IP));
        assert!(!scrubbed.contains("user@example.com"));

        let jwt = scrub_pii_text("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig here");
        assert!(jwt.contains(REPL_JWT));

        let bearer = scrub_pii_text("Authorization Bearer abcdefghijklmnopqrstuvwxyz012345");
        assert!(bearer.contains(REPL_BEARER));

        let url = scrub_pii_text("db://admin:s3cret@host/db");
        assert!(url.contains("***:***@"));
        assert!(!url.contains("s3cret"));
    }
}
