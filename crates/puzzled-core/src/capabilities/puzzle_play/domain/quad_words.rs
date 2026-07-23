//! Quad Words (Quordle) pure score + board helpers — mirrors
//! `apps/puzzled/src/games/quad-words/types.ts` + `config.ts#validateAndScore`.
//!
//! Letter evaluation reuses [`crate::capabilities::puzzle_play::wordle_eval`]. NO authority_rust / ts_deleted.

use crate::capabilities::puzzle_play::wordle_eval::{evaluate_guess, is_winning_guess, LetterStatus};

/// Max guesses allowed (Quordle standard in this app).
pub const MAX_GUESSES: u32 = 9;
/// Optimal guess count for full score.
pub const OPTIMAL_GUESSES: u32 = 5;
/// Floor score for a win within max guesses.
pub const MIN_WIN_SCORE: u32 = 40;

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

/// Prefer correct > present > absent > empty across boards (keyboard aggregate).
#[must_use]
pub fn get_best_status(statuses: &[LetterStatus]) -> Option<LetterStatus> {
    if statuses.is_empty() {
        return None;
    }
    if statuses.contains(&LetterStatus::Correct) {
        return Some(LetterStatus::Correct);
    }
    if statuses.contains(&LetterStatus::Present) {
        return Some(LetterStatus::Present);
    }
    if statuses.contains(&LetterStatus::Absent) {
        return Some(LetterStatus::Absent);
    }
    None
}

/// Evaluate one guess against four targets.
#[must_use]
pub fn evaluate_four(guess: &str, targets: &[&str; 4]) -> Option<[Vec<LetterStatus>; 4]> {
    let a = evaluate_guess(guess, targets[0])?;
    let b = evaluate_guess(guess, targets[1])?;
    let c = evaluate_guess(guess, targets[2])?;
    let d = evaluate_guess(guess, targets[3])?;
    Some([a, b, c, d])
}

/// Score: `max(40, 100 - (guesses - 5) * 10)` for a win.
#[must_use]
pub fn quad_words_score(guess_count: u32) -> u32 {
    if guess_count < OPTIMAL_GUESSES {
        // Still allow early solves at 100 (same formula saturates upward).
        return 100;
    }
    let penalty = guess_count
        .saturating_sub(OPTIMAL_GUESSES)
        .saturating_mul(10);
    100u32.saturating_sub(penalty).max(MIN_WIN_SCORE)
}

/// Validate claimed status + solved board count + guess budget; compute score.
#[must_use]
pub fn validate_and_score(
    solved_boards: Option<u32>,
    guess_count: Option<u32>,
    claimed: SubmissionStatus,
) -> GameResult {
    if claimed == SubmissionStatus::Lost {
        if solved_boards == Some(4) {
            return GameResult::Invalid {
                error: "Invalid loss claim - all boards solved".into(),
            };
        }
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    if solved_boards != Some(4) {
        return GameResult::Invalid {
            error: "Not all boards solved".into(),
        };
    }

    let guess_count = guess_count.unwrap_or(0);
    if guess_count > MAX_GUESSES {
        return GameResult::Invalid {
            error: "Too many guesses".into(),
        };
    }

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: quad_words_score(guess_count),
    }
}

/// True when a guess fully solves a board (all correct).
#[must_use]
pub fn guess_solves_target(guess: &str, target: &str) -> bool {
    evaluate_guess(guess, target)
        .map(|s| is_winning_guess(&s))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::puzzle_play::wordle_eval::WORD_LENGTH;

    #[test]
    fn best_status_priority() {
        assert_eq!(
            get_best_status(&[LetterStatus::Absent, LetterStatus::Present]),
            Some(LetterStatus::Present)
        );
        assert_eq!(
            get_best_status(&[LetterStatus::Present, LetterStatus::Correct]),
            Some(LetterStatus::Correct)
        );
    }

    #[test]
    fn score_table() {
        assert_eq!(quad_words_score(5), 100);
        assert_eq!(quad_words_score(6), 90);
        assert_eq!(quad_words_score(7), 80);
        assert_eq!(quad_words_score(8), 70);
        assert_eq!(quad_words_score(9), 60);
        assert_eq!(quad_words_score(4), 100);
    }

    #[test]
    fn win_at_optimal() {
        let r = validate_and_score(Some(4), Some(5), SubmissionStatus::Won);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }

    #[test]
    fn loss_valid_when_not_all_solved() {
        let r = validate_and_score(Some(2), Some(9), SubmissionStatus::Lost);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
    }

    #[test]
    fn false_loss_rejected() {
        let r = validate_and_score(Some(4), Some(6), SubmissionStatus::Lost);
        assert!(!r.is_valid());
    }

    #[test]
    fn too_many_guesses_rejected() {
        let r = validate_and_score(Some(4), Some(10), SubmissionStatus::Won);
        assert!(!r.is_valid());
    }

    #[test]
    fn evaluate_four_and_solve() {
        let targets = ["crane", "slate", "world", "hello"];
        let Some(results) = evaluate_four("crane", &targets) else {
            panic!("evaluate_four returned None");
        };
        assert!(is_winning_guess(&results[0]));
        assert!(!is_winning_guess(&results[1]));
        assert_eq!(results[0].len(), WORD_LENGTH);
        assert!(guess_solves_target("hello", "hello"));
    }
}
