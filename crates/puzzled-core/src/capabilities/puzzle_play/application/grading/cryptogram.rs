//! Cryptogram graded on the server (`PuzzleService.CheckGuess`), so the client
//! never holds the plaintext or the cipher.
//!
//! Two guess shapes:
//! - `{"guesses": {ENC: PLAIN, ...}}` → `{"solved": bool}`. The client asks
//!   only once every letter is filled, so it is never a per-letter oracle.
//! - `{"hint": true, "guesses": {...}, "revealed": [ENC, ...]}` →
//!   `{"encrypted": ENC, "letter": PLAIN}` for the first encrypted letter (A–Z
//!   order, the client's `getUniqueLetters` order) not yet right and not yet
//!   revealed, or `{"encrypted": null}` when none is left.
//!
//! Solution shape (TS generator): `{originalText, cipher, reverseCipher}`.

use std::collections::BTreeSet;

use serde_json::{json, Map, Value};

/// Encrypted letters that occur in the puzzle, in A–Z order.
fn encrypted_letters(solution: &Value) -> Result<BTreeSet<String>, String> {
    let text = solution
        .get("originalText")
        .and_then(Value::as_str)
        .ok_or("missing originalText")?;
    let cipher = solution
        .get("cipher")
        .and_then(Value::as_object)
        .ok_or("missing cipher")?;
    let mut letters = BTreeSet::new();
    for ch in text.to_uppercase().chars().filter(char::is_ascii_uppercase) {
        let enc = cipher
            .get(&ch.to_string())
            .and_then(Value::as_str)
            .ok_or("cipher does not cover the text")?;
        letters.insert(enc.to_uppercase());
    }
    Ok(letters)
}

fn correct_letter<'a>(reverse: &'a Map<String, Value>, enc: &str) -> Option<&'a str> {
    reverse.get(enc).and_then(Value::as_str)
}

fn guessed(guesses: Option<&Map<String, Value>>, enc: &str) -> String {
    guesses
        .and_then(|g| g.get(enc))
        .and_then(Value::as_str)
        .map(|s| s.trim().to_uppercase())
        .unwrap_or_default()
}

/// Grade a cryptogram guess against the stored solution.
pub fn grade(solution: &Value, guess: &Value) -> Result<Value, String> {
    let reverse = solution
        .get("reverseCipher")
        .and_then(Value::as_object)
        .ok_or("missing reverseCipher")?;
    let letters = encrypted_letters(solution)?;
    let guesses = guess.get("guesses").and_then(Value::as_object);

    if guess.get("hint").and_then(Value::as_bool) == Some(true) {
        let revealed: BTreeSet<String> = guess
            .get("revealed")
            .and_then(Value::as_array)
            .map(|r| {
                r.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_uppercase)
                    .collect()
            })
            .unwrap_or_default();
        for enc in &letters {
            let Some(correct) = correct_letter(reverse, enc) else {
                return Err(format!("reverseCipher misses {enc}"));
            };
            if revealed.contains(enc) || guessed(guesses, enc) == correct {
                continue;
            }
            return Ok(json!({ "encrypted": enc, "letter": correct }));
        }
        return Ok(json!({ "encrypted": null }));
    }

    let guesses = guesses.ok_or("missing guesses")?;
    let solved = letters
        .iter()
        .all(|enc| correct_letter(reverse, enc).is_some_and(|c| guessed(Some(guesses), enc) == c));
    Ok(json!({ "solved": solved }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Value {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/generate/cryptogram.json");
        let text = std::fs::read_to_string(path).unwrap_or_default();
        let cases: Vec<Value> = serde_json::from_str(&text).unwrap_or_default();
        cases
            .into_iter()
            .find(|c| c.get("solution").is_some())
            .map(|c| c["solution"].clone())
            .unwrap_or(Value::Null)
    }

    fn full_guesses(solution: &Value) -> Map<String, Value> {
        let letters = encrypted_letters(solution).unwrap_or_default();
        letters
            .iter()
            .map(|enc| (enc.clone(), solution["reverseCipher"][enc].clone()))
            .collect()
    }

    #[test]
    fn a_correct_decoding_is_solved_and_a_wrong_one_is_not() {
        let solution = fixture();
        let mut guesses = full_guesses(&solution);
        let graded = grade(&solution, &json!({ "guesses": guesses })).unwrap_or_default();
        assert_eq!(graded, json!({ "solved": true }));

        let first = guesses.keys().next().cloned().unwrap_or_default();
        guesses.insert(first, json!("#"));
        let graded = grade(&solution, &json!({ "guesses": guesses })).unwrap_or_default();
        assert_eq!(graded, json!({ "solved": false }));
    }

    #[test]
    fn hints_reveal_the_first_unsolved_letter_and_skip_revealed_ones() {
        let solution = fixture();
        let letters: Vec<String> = encrypted_letters(&solution)
            .unwrap_or_default()
            .into_iter()
            .collect();
        let first = letters[0].clone();
        let hint = grade(&solution, &json!({ "hint": true, "guesses": {} })).unwrap_or_default();
        assert_eq!(hint["encrypted"], json!(first));
        assert_eq!(hint["letter"], solution["reverseCipher"][&first]);

        let next = grade(
            &solution,
            &json!({ "hint": true, "guesses": {}, "revealed": [first] }),
        )
        .unwrap_or_default();
        assert_eq!(next["encrypted"], json!(letters[1]));

        let all = full_guesses(&solution);
        let none = grade(&solution, &json!({ "hint": true, "guesses": all })).unwrap_or_default();
        assert_eq!(none, json!({ "encrypted": null }));
    }

    #[test]
    fn letters_not_in_the_quote_are_not_graded() {
        let solution = fixture();
        let letters = encrypted_letters(&solution).unwrap_or_default();
        let puzzle_letters: BTreeSet<String> = "XB FVR EXWWSR NJ WXJJXDTSFC SXRK NIINZFTBXFC."
            .chars()
            .filter(char::is_ascii_uppercase)
            .map(|c| c.to_string())
            .collect();
        assert_eq!(letters, puzzle_letters);
        assert!(grade(&solution, &json!({})).is_err());
    }
}
