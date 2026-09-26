//! Grade one word-hive word against the stored word list, so the client never
//! holds the list (`PuzzleService.CheckGuess`).
//!
//! Guess: `{"word":"ACCEDE"}`. Result:
//! `{"valid":bool,"pangram":bool,"totalWords":n,"totalPangrams":m}`. The
//! totals are counts, not answers; the client needs them for "found x of y"
//! and to end the game when every word is found. Length, centre-letter and
//! letter-set checks stay on the client; the final finish is still validated
//! by `submission_validation`.

use serde_json::{json, Value};

fn upper_list(solution: &Value, key: &str) -> Result<Vec<String>, String> {
    Ok(solution
        .get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing word-hive {key}"))?
        .iter()
        .filter_map(Value::as_str)
        .map(str::to_uppercase)
        .collect())
}

/// Grade `guess` against the stored `{"validWords":[..],"pangrams":[..]}`.
pub fn grade(solution: &Value, guess: &Value) -> Result<Value, String> {
    let valid_words = upper_list(solution, "validWords")?;
    let pangrams = upper_list(solution, "pangrams").unwrap_or_default();
    let word = guess
        .get("word")
        .and_then(Value::as_str)
        .ok_or("missing guess word")?
        .trim()
        .to_uppercase();
    if word.is_empty() {
        return Err("missing guess word".into());
    }
    let valid = valid_words.contains(&word);
    Ok(json!({
        "valid": valid,
        "pangram": valid && pangrams.contains(&word),
        "totalWords": valid_words.len(),
        "totalPangrams": pangrams.len(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solution() -> Value {
        json!({"validWords": ["ACCEDE", "ACED", "DECALS"], "pangrams": ["DECALS"]})
    }

    #[test]
    fn grades_membership_and_pangrams_case_insensitively() {
        assert_eq!(
            grade(&solution(), &json!({"word": "aced"})).unwrap(),
            json!({"valid": true, "pangram": false, "totalWords": 3, "totalPangrams": 1})
        );
        assert_eq!(
            grade(&solution(), &json!({"word": "Decals"})).unwrap()["pangram"],
            true
        );
        let miss = grade(&solution(), &json!({"word": "CADS"})).unwrap();
        assert_eq!(miss["valid"], false);
        assert_eq!(miss["pangram"], false);
    }

    #[test]
    fn never_returns_the_word_list() {
        let text = grade(&solution(), &json!({"word": "CADS"}))
            .unwrap()
            .to_string();
        assert!(!text.contains("ACCEDE"));
        assert!(grade(&solution(), &json!({})).is_err());
        assert!(grade(&json!({}), &json!({"word": "ACED"})).is_err());
    }
}
