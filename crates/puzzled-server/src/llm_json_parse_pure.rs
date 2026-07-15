//! Pure LLM response JSON extraction —
//! dual-oracle residual of
//! `apps/puzzled/src/features/puzzle-generator/lib/parse-utils.ts`
//! `parseLlmJsonResponse` (markdown fences + embedded object).
//! OpenRouter / generator I/O stays FE-TS residual.
//! NO authority_rust / ts_deleted.

/// Strip common markdown code fences from an LLM response body.
///
/// Parity: TS strips leading \`\`\`json / \`\`\` and trailing \`\`\`.
#[must_use]
pub fn strip_markdown_fences(response: &str) -> String {
    let mut cleaned = response.trim().to_string();
    if let Some(rest) = cleaned.strip_prefix("```json") {
        cleaned = rest.to_string();
    } else if let Some(rest) = cleaned.strip_prefix("```") {
        cleaned = rest.to_string();
    }
    let trimmed_end = cleaned.trim_end();
    if let Some(rest) = trimmed_end.strip_suffix("```") {
        cleaned = rest.to_string();
    } else {
        cleaned = trimmed_end.to_string();
    }
    cleaned.trim().to_string()
}

/// Whether cleaned body looks like a JSON value start (`{` or `[`).
#[must_use]
pub fn looks_like_json_start(cleaned: &str) -> bool {
    let t = cleaned.trim_start();
    t.starts_with('{') || t.starts_with('[')
}

/// Extract first top-level `{...}` substring (greedy outer braces).
/// Dual-oracle of TS `response.match(/\{[\s\S]*\}/)`.
#[must_use]
pub fn extract_first_json_object(response: &str) -> Option<&str> {
    let start = response.find('{')?;
    let end = response.rfind('}')?;
    if end < start {
        return None;
    }
    Some(&response[start..=end])
}

/// Validate cleaned / extracted text parses as JSON value.
/// Returns `true` when `serde_json` accepts the text (TS `JSON.parse` success).
#[must_use]
pub fn is_valid_json_text(text: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(text).is_ok()
}

/// Full dual-oracle of `parseLlmJsonResponse` success path (no typed T).
/// Returns parsed JSON value or `None` (TS null on failure).
#[must_use]
pub fn parse_llm_json_response(response: &str) -> Option<serde_json::Value> {
    let cleaned = strip_markdown_fences(response);
    if looks_like_json_start(&cleaned) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&cleaned) {
            return Some(v);
        }
    }
    let extracted = extract_first_json_object(response)?;
    serde_json::from_str(extracted).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fence_strip_and_parse() {
        let raw = "```json\n{\"a\":1}\n```";
        assert_eq!(strip_markdown_fences(raw), r#"{"a":1}"#);
        assert_eq!(parse_llm_json_response(raw), Some(json!({"a": 1})));

        let bare = r#"{"b":[1,2]}"#;
        assert!(looks_like_json_start(bare));
        assert_eq!(parse_llm_json_response(bare), Some(json!({"b": [1, 2]})));

        let prose = "Here you go: {\"ok\":true} thanks";
        assert_eq!(
            extract_first_json_object(prose),
            Some(r#"{"ok":true}"#)
        );
        assert_eq!(parse_llm_json_response(prose), Some(json!({"ok": true})));

        assert!(parse_llm_json_response("not json").is_none());
        assert!(parse_llm_json_response("```\nnope\n```").is_none());
        assert!(is_valid_json_text("[1,2,3]"));
        assert!(!is_valid_json_text("x"));
    }

    #[test]
    fn array_fence() {
        let raw = "```\n[1,2]\n```";
        assert_eq!(parse_llm_json_response(raw), Some(json!([1, 2])));
    }
}
