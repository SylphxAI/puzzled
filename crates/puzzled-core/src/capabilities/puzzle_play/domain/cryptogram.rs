//! Cryptogram pure substitution check + score — mirrors
//! `apps/puzzled/src/games/cryptogram/config.ts#validateAndScore`.
//!
//! PORTFOLIO residual pure deepen. NO authority_rust / ts_deleted.

use std::collections::{BTreeMap, BTreeSet};

/// Base score for a correct win before time/hint penalties.
pub const BASE_WIN_SCORE: u32 = 500;
/// Floor score for a win.
pub const MIN_WIN_SCORE: u32 = 100;
/// Hint penalty per hint used.
pub const HINT_PENALTY: u32 = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameResult {
    Invalid {
        error: String,
    },
    Valid {
        status: SubmissionStatus,
        score: u32,
    },
}

impl GameResult {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        matches!(self, Self::Valid { .. })
    }
}

/// Unique A–Z letters appearing in `encrypted` text (uppercased).
#[must_use]
pub fn unique_encrypted_letters(encrypted: &str) -> BTreeSet<char> {
    encrypted
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

/// True when every cipher letter that appears in the puzzle text (`required`)
/// is guessed as its expected plaintext. Letters of the stored solution that do
/// not appear in the puzzle are not asked of the player. A required letter the
/// solution does not know is never solved.
#[must_use]
pub fn is_fully_solved(
    reverse_cipher: &BTreeMap<String, String>,
    guesses: &BTreeMap<String, String>,
    required: &BTreeSet<char>,
) -> bool {
    for letter in required {
        let encrypted = letter.to_string();
        let expected = reverse_cipher.get(&encrypted).map(String::as_str);
        let actual = guesses.get(&encrypted).map(String::as_str);
        match (expected, actual) {
            (Some(e), Some(a)) if e.eq_ignore_ascii_case(a) => {}
            _ => return false,
        }
    }
    true
}

/// Score: `max(100, 500 - floor(seconds/2) - hints*50)`.
#[must_use]
pub fn cryptogram_score(time_spent_ms: u64, hints_used: u32) -> u32 {
    let seconds = time_spent_ms / 1000;
    let time_penalty = (seconds / 2) as u32;
    let hint_penalty = hints_used.saturating_mul(HINT_PENALTY);
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .saturating_sub(hint_penalty)
        .max(MIN_WIN_SCORE)
}

/// Validate guesses (for the `required` puzzle letters) against reverse cipher + claimed status; compute score.
#[must_use]
pub fn validate_and_score(
    reverse_cipher: &BTreeMap<String, String>,
    guesses: Option<&BTreeMap<String, String>>,
    required: &BTreeSet<char>,
    hints_used: Option<u32>,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(guesses) = guesses else {
        return GameResult::Invalid {
            error: "Missing guesses data".into(),
        };
    };

    let all_correct = is_fully_solved(reverse_cipher, guesses, required);

    if claimed == SubmissionStatus::Won && !all_correct {
        return GameResult::Invalid {
            error: "Invalid win claim - solution mismatch".into(),
        };
    }
    if claimed == SubmissionStatus::Lost && all_correct {
        return GameResult::Invalid {
            error: "Invalid loss claim - puzzle is solved".into(),
        };
    }

    if !all_correct {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    let hints = hints_used.unwrap_or(0);
    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: cryptogram_score(time_spent_ms, hints),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_cipher() -> BTreeMap<String, String> {
        // encrypted -> original
        BTreeMap::from([("X".into(), "H".into()), ("Y".into(), "I".into())])
    }

    fn req() -> BTreeSet<char> {
        BTreeSet::from(['X', 'Y'])
    }

    fn correct_guesses() -> BTreeMap<String, String> {
        BTreeMap::from([("X".into(), "H".into()), ("Y".into(), "I".into())])
    }

    #[test]
    fn unique_letters_upper() {
        let u = unique_encrypted_letters("AbC! a");
        assert_eq!(u, BTreeSet::from(['A', 'B', 'C']));
    }

    #[test]
    fn score_table() {
        // 0s, 0 hints -> 500
        assert_eq!(cryptogram_score(0, 0), 500);
        // 120s -> -60, score 440
        assert_eq!(cryptogram_score(120_000, 0), 440);
        // 1 hint -> -50
        assert_eq!(cryptogram_score(0, 1), 450);
        // heavy time floors at 100
        assert_eq!(cryptogram_score(1_000_000, 10), 100);
    }

    #[test]
    fn perfect_win() {
        let cipher = sample_cipher();
        let guesses = correct_guesses();
        let result = validate_and_score(
            &cipher,
            Some(&guesses),
            &req(),
            Some(0),
            0,
            SubmissionStatus::Won,
        );
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
    }

    #[test]
    fn false_win_rejected() {
        let cipher = sample_cipher();
        let mut guesses = correct_guesses();
        guesses.insert("X".into(), "Z".into());
        let result = validate_and_score(
            &cipher,
            Some(&guesses),
            &req(),
            Some(0),
            0,
            SubmissionStatus::Won,
        );
        assert!(!result.is_valid());
    }

    #[test]
    fn false_loss_rejected() {
        let cipher = sample_cipher();
        let guesses = correct_guesses();
        let result = validate_and_score(
            &cipher,
            Some(&guesses),
            &req(),
            Some(0),
            0,
            SubmissionStatus::Lost,
        );
        assert!(!result.is_valid());
    }

    #[test]
    fn incomplete_is_loss() {
        let cipher = sample_cipher();
        let guesses = BTreeMap::from([("X".into(), "H".into())]);
        let result = validate_and_score(
            &cipher,
            Some(&guesses),
            &req(),
            Some(0),
            0,
            SubmissionStatus::Lost,
        );
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
    }

    #[test]
    fn missing_guesses_invalid() {
        let cipher = sample_cipher();
        let result = validate_and_score(&cipher, None, &req(), None, 0, SubmissionStatus::Won);
        assert!(!result.is_valid());
    }

    /// The stored solution maps all 26 letters but the puzzle text uses only a few.
    fn full_alphabet_cipher() -> BTreeMap<String, String> {
        ('A'..='Z')
            .map(|c| {
                (
                    c.to_string(),
                    char::from(b'Z' - (c as u8 - b'A')).to_string(),
                )
            })
            .collect()
    }

    #[test]
    fn win_needs_only_letters_present_in_the_puzzle() {
        let cipher = full_alphabet_cipher();
        let required = unique_encrypted_letters("ABC, ab!");
        assert_eq!(required.len(), 3);
        let guesses = BTreeMap::from([
            ("A".to_string(), "Z".to_string()),
            ("B".to_string(), "Y".to_string()),
            ("C".to_string(), "X".to_string()),
        ]);
        let won = validate_and_score(
            &cipher,
            Some(&guesses),
            &required,
            Some(0),
            0,
            SubmissionStatus::Won,
        );
        assert_eq!(
            won,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
    }

    #[test]
    fn every_present_letter_must_still_be_correct() {
        let cipher = full_alphabet_cipher();
        let required = unique_encrypted_letters("ABC");
        // one wrong
        let mut guesses = BTreeMap::from([
            ("A".to_string(), "Z".to_string()),
            ("B".to_string(), "Y".to_string()),
            ("C".to_string(), "Q".to_string()),
        ]);
        let r = validate_and_score(
            &cipher,
            Some(&guesses),
            &required,
            Some(0),
            0,
            SubmissionStatus::Won,
        );
        assert!(!r.is_valid());
        // one missing
        guesses.remove("C");
        let r = validate_and_score(
            &cipher,
            Some(&guesses),
            &required,
            Some(0),
            0,
            SubmissionStatus::Won,
        );
        assert!(!r.is_valid());
    }

    #[test]
    fn required_letter_unknown_to_the_solution_is_not_solved() {
        let cipher = sample_cipher();
        let required = BTreeSet::from(['X', 'Q']);
        let guesses = BTreeMap::from([
            ("X".to_string(), "H".to_string()),
            ("Q".to_string(), "H".to_string()),
        ]);
        assert!(!is_fully_solved(&cipher, &guesses, &required));
    }
}
