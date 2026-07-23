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

// ── wave70 pure residual unit: HTML entity escape table dual-oracle residual ──
// Dual-oracle residual of utils.ts _escapeHtml entity map pure half.
// Email send I/O residual retained. pure residual ≠ authority flip.

/// Dual-oracle residual: entity map covers five significant chars.
#[must_use]
pub fn entity_map_covers_five() -> bool {
    escape_html(r#"&<>"'"#) == "&amp;&lt;&gt;&quot;&#39;"
}

/// Dual-oracle residual: idempotent on safe text.
#[must_use]
pub fn escape_idempotent_on_safe() -> bool {
    let s = "hello world 123";
    escape_html(s) == s && !needs_escape(s)
}

/// Dual-oracle residual: needs_escape detects any special.
#[must_use]
pub fn needs_escape_any_special_shell() -> bool {
    needs_escape("&")
        && needs_escape("<")
        && needs_escape(">")
        && needs_escape("\"")
        && needs_escape("'")
        && !needs_escape("safe-text_ok")
}

/// Dual-oracle residual: script injection neutralized.
#[must_use]
pub fn script_injection_neutralized() -> bool {
    let out = escape_html(r#"<img src=x onerror='alert(1)'>"#);
    !out.contains('<') && !out.contains('>') && out.contains("&lt;img") && out.contains("&#39;")
}

#[cfg(test)]
mod wave70_tests {
    use super::*;

    #[test]
    fn wave70_html_entity_escape_table_dual_oracle() {
        assert!(entity_map_covers_five());
        assert!(escape_idempotent_on_safe());
        assert!(needs_escape_any_special_shell());
        assert!(script_injection_neutralized());
        assert_eq!(escape_html("a & b < c"), "a &amp; b &lt; c");
    }
}
