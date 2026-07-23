//! Pure Wordle guess evaluation + validateAndScore —
//! mirrors `apps/puzzled/src/games/word-guess/config.ts`.
//! PORTFOLIO residual pure continue4. NO authority_rust / ts_deleted.
//!
//! Dictionary membership is injectable so this kernel stays pure/IO-free
//! (same pattern as word_ladder).

use std::collections::HashSet;

use crate::capabilities::puzzle_play::game_format::calculate_wordle_score;

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
        if let Some(idx) = solution_chars
            .iter()
            .position(|&c| c == Some(guess_chars[i]))
        {
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

/// Perfect game for word-guess: solved in one attempt (config.isPerfectGame).
#[must_use]
pub fn is_perfect_game(attempts: u32) -> bool {
    attempts == 1
}

/// Format share score: `X/6` on loss, `{attempts}/6` on win.
#[must_use]
pub fn format_score_display(status: SubmissionStatus, attempts: u32) -> String {
    match status {
        SubmissionStatus::Lost => "X/6".into(),
        SubmissionStatus::Won => format!("{attempts}/6"),
    }
}

/// Percentile comparator: wins beat losses; among wins fewer attempts is better.
/// Mirrors `compareForPercentile` return sign.
#[must_use]
pub fn compare_for_percentile(
    a_won: bool,
    a_attempts: Option<u32>,
    b_won: bool,
    b_attempts: Option<u32>,
) -> i64 {
    if a_won && !b_won {
        return 1;
    }
    if !a_won && b_won {
        return -1;
    }
    let a = i64::from(a_attempts.unwrap_or(6));
    let b = i64::from(b_attempts.unwrap_or(6));
    b - a
}

/// Validate submission + score — mirrors `validateAndScore`.
///
/// - Missing/empty guesses → invalid
/// - When `word_list` is `Some`, each guess must be a member (uppercased)
/// - Win/loss claim must match final-guess equality to solution
/// - Score uses shared Wordle formula via [`calculate_wordle_score`]
///
/// When `word_list` is `None`, dictionary checks are skipped (unit/oracle mode).
#[must_use]
pub fn validate_and_score(
    solution_word: &str,
    guesses: Option<&[String]>,
    claimed: SubmissionStatus,
    word_list: Option<&HashSet<String>>,
) -> GameResult {
    let Some(raw) = guesses else {
        return GameResult::Invalid {
            error: "Missing guesses data".into(),
        };
    };
    if raw.is_empty() {
        return GameResult::Invalid {
            error: "Missing guesses data".into(),
        };
    }

    let solution = solution_word.to_ascii_uppercase();
    let guesses_upper: Vec<String> = raw.iter().map(|g| g.to_ascii_uppercase()).collect();

    for guess in &guesses_upper {
        if let Some(list) = word_list {
            if !list.contains(guess) {
                return GameResult::Invalid {
                    error: format!("Invalid word in guesses: {guess}"),
                };
            }
        }
    }

    let last = guesses_upper.last().map(String::as_str).unwrap_or_default();
    let won = last == solution;

    if claimed == SubmissionStatus::Won && !won {
        return GameResult::Invalid {
            error: "Invalid win claim - final guess does not match solution".into(),
        };
    }
    if claimed == SubmissionStatus::Lost && won {
        return GameResult::Invalid {
            error: "Invalid loss claim - final guess matches solution".into(),
        };
    }

    let attempts = guesses_upper.len() as u32;
    let status = if won {
        SubmissionStatus::Won
    } else {
        SubmissionStatus::Lost
    };
    GameResult::Valid {
        status,
        score: calculate_wordle_score(won, attempts),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(xs: &[&str]) -> Vec<String> {
        xs.iter().map(|s| (*s).to_string()).collect()
    }

    fn dict(xs: &[&str]) -> HashSet<String> {
        xs.iter().map(|s| s.to_ascii_uppercase()).collect()
    }

    #[test]
    fn all_correct() {
        let r = evaluate_guess("crane", "crane").unwrap_or_else(|| panic!("evaluate"));
        assert!(is_winning_guess(&r));
        assert!(r.iter().all(|s| *s == LetterStatus::Correct));
    }

    #[test]
    fn classic_duplicate_handling() {
        // ABIDE vs SPEED: E present once, D present
        let r = evaluate_guess("speed", "abide").unwrap_or_else(|| panic!("evaluate speed"));
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
        let r2 = evaluate_guess("hello", "world").unwrap_or_else(|| panic!("evaluate hello"));
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
        let r = evaluate_guess("CrAnE", "crane").unwrap_or_else(|| panic!("evaluate"));
        assert!(is_winning_guess(&r));
    }

    #[test]
    fn score_table_matches_ts_oracle() {
        // TS validation.test.ts scoring: 100 - (attempts-1)*15 floor 25; loss 0
        assert_eq!(calculate_wordle_score(true, 1), 100);
        assert_eq!(calculate_wordle_score(true, 2), 85);
        assert_eq!(calculate_wordle_score(true, 3), 70);
        assert_eq!(calculate_wordle_score(true, 4), 55);
        assert_eq!(calculate_wordle_score(true, 5), 40);
        assert_eq!(calculate_wordle_score(true, 6), 25);
        assert_eq!(calculate_wordle_score(false, 6), 0);
    }

    #[test]
    fn validate_win_first_attempt() {
        let g = words(&["CRANE"]);
        let r = validate_and_score("crane", Some(&g), SubmissionStatus::Won, None);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }

    #[test]
    fn validate_win_second_attempt() {
        let g = words(&["SLATE", "CRANE"]);
        let r = validate_and_score("crane", Some(&g), SubmissionStatus::Won, None);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 85
            }
        );
    }

    #[test]
    fn validate_loss_scores_zero() {
        let g = words(&["SLATE", "AUDIO", "PLUMB", "QUICK", "JUMPY", "WORLD"]);
        let r = validate_and_score("crane", Some(&g), SubmissionStatus::Lost, None);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
    }

    #[test]
    fn validate_missing_and_empty() {
        assert!(matches!(
            validate_and_score("crane", None, SubmissionStatus::Won, None),
            GameResult::Invalid { error } if error.contains("Missing guesses")
        ));
        let empty: Vec<String> = vec![];
        assert!(matches!(
            validate_and_score("crane", Some(&empty), SubmissionStatus::Won, None),
            GameResult::Invalid { error } if error.contains("Missing guesses")
        ));
    }

    #[test]
    fn validate_false_win_and_loss_claims() {
        let g = words(&["SLATE", "AUDIO"]);
        assert!(matches!(
            validate_and_score("crane", Some(&g), SubmissionStatus::Won, None),
            GameResult::Invalid { error } if error.contains("Invalid win claim")
        ));
        let win = words(&["SLATE", "CRANE"]);
        assert!(matches!(
            validate_and_score("crane", Some(&win), SubmissionStatus::Lost, None),
            GameResult::Invalid { error } if error.contains("Invalid loss claim")
        ));
    }

    #[test]
    fn validate_dictionary_rejects_invalid_word() {
        let list = dict(&["CRANE", "SLATE"]);
        let g = words(&["XYZAB", "CRANE"]);
        assert!(matches!(
            validate_and_score("crane", Some(&g), SubmissionStatus::Won, Some(&list)),
            GameResult::Invalid { error } if error.contains("Invalid word")
        ));
    }

    #[test]
    fn validate_case_insensitive_guesses() {
        let g = words(&["crane"]);
        let r = validate_and_score("CrAnE", Some(&g), SubmissionStatus::Won, None);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }

    #[test]
    fn perfect_and_display_and_compare() {
        assert!(is_perfect_game(1));
        assert!(!is_perfect_game(2));
        assert_eq!(format_score_display(SubmissionStatus::Lost, 6), "X/6");
        assert_eq!(format_score_display(SubmissionStatus::Won, 3), "3/6");
        assert!(compare_for_percentile(true, Some(2), false, Some(6)) > 0);
        assert!(compare_for_percentile(true, Some(2), true, Some(4)) > 0);
        assert_eq!(compare_for_percentile(true, Some(3), true, Some(3)), 0);
    }
}
