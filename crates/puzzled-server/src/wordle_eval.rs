//! Pure Wordle guess evaluation — mirrors
//! `apps/puzzled/src/games/word-guess/config.ts#evaluateGuess`.
//! FLEET-PRODUCTS-WAVE4 pure residual. NO authority_rust / ts_deleted.

pub const WORD_LENGTH: usize = 5;
pub const MAX_GUESSES: u32 = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LetterStatus {
    Correct,
    Present,
    Absent,
}

impl LetterStatus {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Correct => "correct",
            Self::Present => "present",
            Self::Absent => "absent",
        }
    }
}

/// Evaluate a guess against the solution (standard Wordle two-pass algorithm).
/// Inputs are uppercased for comparison; length must be WORD_LENGTH.
#[must_use]
pub fn evaluate_guess(guess: &str, solution: &str) -> Option<Vec<LetterStatus>> {
    let guess: String = guess.chars().map(|c| c.to_ascii_uppercase()).collect();
    let solution: String = solution.chars().map(|c| c.to_ascii_uppercase()).collect();
    if guess.chars().count() != WORD_LENGTH || solution.chars().count() != WORD_LENGTH {
        return None;
    }
    let mut result = vec![LetterStatus::Absent; WORD_LENGTH];
    let mut solution_chars: Vec<Option<char>> = solution.chars().map(Some).collect();
    let guess_chars: Vec<char> = guess.chars().collect();

    // First pass: mark correct letters
    for i in 0..WORD_LENGTH {
        if Some(guess_chars[i]) == solution_chars[i] {
            result[i] = LetterStatus::Correct;
            solution_chars[i] = None;
        }
    }

    // Second pass: mark present letters
    for i in 0..WORD_LENGTH {
        if result[i] == LetterStatus::Correct {
            continue;
        }
        if let Some(idx) = solution_chars.iter().position(|&c| c == Some(guess_chars[i])) {
            result[i] = LetterStatus::Present;
            solution_chars[idx] = None;
        }
    }

    Some(result)
}

/// Whether the guess is fully correct.
#[must_use]
pub fn is_winning_guess(statuses: &[LetterStatus]) -> bool {
    !statuses.is_empty() && statuses.iter().all(|s| *s == LetterStatus::Correct)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_correct() {
        let r = evaluate_guess("crane", "crane").unwrap();
        assert!(is_winning_guess(&r));
        assert!(r.iter().all(|s| *s == LetterStatus::Correct));
    }

    #[test]
    fn classic_duplicate_handling() {
        // ABIDE vs SPEED: E present once, D present
        let r = evaluate_guess("speed", "abide").unwrap();
        assert_eq!(
            r,
            vec![
                LetterStatus::Absent,
                LetterStatus::Absent,
                LetterStatus::Present,
                LetterStatus::Absent,
                LetterStatus::Present,
            ]
        );
        // WORLD vs HELLO: L present once, O present
        let r2 = evaluate_guess("hello", "world").unwrap();
        assert_eq!(
            r2,
            vec![
                LetterStatus::Absent,  // H
                LetterStatus::Absent,  // E
                LetterStatus::Absent,  // L (duplicate consumed by correct L)
                LetterStatus::Correct, // L
                LetterStatus::Present, // O
            ]
        );
    }

    #[test]
    fn length_reject() {
        assert!(evaluate_guess("hi", "crane").is_none());
    }

    #[test]
    fn case_insensitive() {
        let r = evaluate_guess("CrAnE", "crane").unwrap();
        assert!(is_winning_guess(&r));
    }
}
