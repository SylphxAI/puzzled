//! Pure HTML entity escape —
//! dual-oracle residual of `apps/puzzled/src/lib/utils.ts` `_escapeHtml`.
//! Prevents XSS in email templates. Email send I/O stays FE-TS.
//! NO authority_rust / ts_deleted.

/// Escape HTML-significant characters (TS `_escapeHtml` entity map).
#[must_use]
pub fn escape_html(str_in: &str) -> String {
    let mut out = String::with_capacity(str_in.len());
    for c in str_in.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// True when input already has no HTML-significant characters.
#[must_use]
pub fn needs_escape(str_in: &str) -> bool {
    str_in
        .chars()
        .any(|c| matches!(c, '&' | '<' | '>' | '"' | '\''))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escape_table() {
        assert_eq!(escape_html("plain"), "plain");
        assert_eq!(escape_html("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;");
        assert_eq!(escape_html("a & b"), "a &amp; b");
        assert_eq!(escape_html(r#""quoted""#), "&quot;quoted&quot;");
        assert_eq!(escape_html("it's"), "it&#39;s");
        assert_eq!(
            escape_html(r#"<script>alert("x")</script>"#),
            "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
        );
        assert!(!needs_escape("ok"));
        assert!(needs_escape("<"));
    }
}
