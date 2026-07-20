//! Word Ladder pure path + score — mirrors
//! `apps/puzzled/src/games/word-ladder/types.ts` + `config.ts#validateAndScore`.
//!
//! PORTFOLIO residual pure deepen. NO authority_rust / ts_deleted.
//! Dictionary membership is injectable so this kernel stays pure/IO-free.

use std::collections::HashSet;

/// Minimum win score (extra-step floor).
pub const MIN_WIN_SCORE: u32 = 25;
/// Base score for an optimal-length win.
pub const BASE_WIN_SCORE: u32 = 100;
/// Penalty per step beyond the optimal path length.
pub const EXTRA_STEP_PENALTY: u32 = 10;

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

/// Exactly one letter differs (same length); mirrors `isOneLetterChange`.
#[must_use]
pub fn is_one_letter_change(word1: &str, word2: &str) -> bool {
    let a: Vec<char> = word1.chars().collect();
    let b: Vec<char> = word2.chars().collect();
    if a.len() != b.len() {
        return false;
    }
    let mut differences = 0u32;
    for (ca, cb) in a.iter().zip(b.iter()) {
        if ca != cb {
            differences += 1;
            if differences > 1 {
                return false;
            }
        }
    }
    differences == 1
}

/// Score: `max(25, 100 - extra_steps * 10)` where extra = player − optimal.
#[must_use]
pub fn word_ladder_score(optimal_steps: u32, player_steps: u32) -> u32 {
    let extra = player_steps.saturating_sub(optimal_steps);
    BASE_WIN_SCORE
        .saturating_sub(extra.saturating_mul(EXTRA_STEP_PENALTY))
        .max(MIN_WIN_SCORE)
}

/// Validate a claimed path and compute score.
///
/// - Lost: always valid with score 0 (no path required).
/// - Won: path must start/end with solution endpoints, each word in `word_list`
///   (when provided), and each step a one-letter change.
/// - When `word_list` is `None`, dictionary checks are skipped (unit/oracle mode).
#[must_use]
pub fn validate_and_score(
    solution_path: &[String],
    player_path: Option<&[String]>,
    claimed: SubmissionStatus,
    word_list: Option<&HashSet<String>>,
) -> GameResult {
    if claimed == SubmissionStatus::Lost {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    let Some(raw_path) = player_path else {
        return GameResult::Invalid {
            error: "No valid path provided".into(),
        };
    };
    if raw_path.len() < 2 {
        return GameResult::Invalid {
            error: "No valid path provided".into(),
        };
    }
    if solution_path.len() < 2 {
        return GameResult::Invalid {
            error: "Invalid solution path".into(),
        };
    }

    let path: Vec<String> = raw_path.iter().map(|w| w.to_ascii_lowercase()).collect();
    let start_word = solution_path[0].to_ascii_lowercase();
    let end_word = solution_path[solution_path.len() - 1].to_ascii_lowercase();

    if path[0] != start_word {
        return GameResult::Invalid {
            error: format!("Path must start with {start_word}"),
        };
    }
    if path[path.len() - 1] != end_word {
        return GameResult::Invalid {
            error: format!("Path must end with {end_word}"),
        };
    }

    for i in 0..path.len() {
        if let Some(list) = word_list {
            if !list.contains(&path[i]) {
                return GameResult::Invalid {
                    error: format!("Invalid word: {}", path[i]),
                };
            }
        }
        if i > 0 && !is_one_letter_change(&path[i - 1], &path[i]) {
            return GameResult::Invalid {
                error: format!("Invalid step: {} → {}", path[i - 1], path[i]),
            };
        }
    }

    let optimal_steps = (solution_path.len() - 1) as u32;
    let player_steps = (path.len() - 1) as u32;
    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: word_ladder_score(optimal_steps, player_steps),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path(words: &[&str]) -> Vec<String> {
        words.iter().map(|w| (*w).to_string()).collect()
    }

    #[test]
    fn one_letter_change_table() {
        assert!(is_one_letter_change("cat", "cot"));
        assert!(is_one_letter_change("cold", "cord"));
        assert!(!is_one_letter_change("cat", "dog"));
        assert!(!is_one_letter_change("cat", "cats"));
        assert!(!is_one_letter_change("same", "same"));
    }

    #[test]
    fn score_table() {
        // optimal
        assert_eq!(word_ladder_score(3, 3), 100);
        // one extra step: 90
        assert_eq!(word_ladder_score(3, 4), 90);
        // many extras floor at 25
        assert_eq!(word_ladder_score(1, 20), 25);
    }

    #[test]
    fn optimal_win() {
        let solution = path(&["cold", "cord", "card", "ward", "warm"]);
        let player = path(&["COLD", "CORD", "CARD", "WARD", "WARM"]);
        let result = validate_and_score(&solution, Some(&player), SubmissionStatus::Won, None);
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }

    #[test]
    fn extra_step_penalty() {
        let solution = path(&["cold", "cord", "card", "ward", "warm"]);
        // detour: cold -> cord -> word -> ward -> warm (same length as optimal 4 steps)
        // longer: cold -> cord -> card -> cord -> card -> ward -> warm
        let player = path(&["cold", "cord", "card", "cord", "card", "ward", "warm"]);
        let result = validate_and_score(&solution, Some(&player), SubmissionStatus::Won, None);
        // optimal 4, player 6 => extra 2 => 80
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 80
            }
        );
    }

    #[test]
    fn invalid_step_rejected() {
        let solution = path(&["cold", "cord", "card", "ward", "warm"]);
        let player = path(&["cold", "warm"]);
        let result = validate_and_score(&solution, Some(&player), SubmissionStatus::Won, None);
        assert!(!result.is_valid());
    }

    #[test]
    fn wrong_endpoints_rejected() {
        let solution = path(&["cold", "cord", "card", "ward", "warm"]);
        let player = path(&["cord", "card", "ward", "warm"]);
        let result = validate_and_score(&solution, Some(&player), SubmissionStatus::Won, None);
        assert!(!result.is_valid());
    }

    #[test]
    fn loss_scores_zero() {
        let solution = path(&["cold", "warm"]);
        let result = validate_and_score(&solution, None, SubmissionStatus::Lost, None);
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
    }

    #[test]
    fn dictionary_gate() {
        let solution = path(&["cat", "cot", "dot"]);
        let player = path(&["cat", "cot", "dot"]);
        let mut list = HashSet::new();
        list.insert("cat".into());
        list.insert("cot".into());
        // missing "dot"
        let result =
            validate_and_score(&solution, Some(&player), SubmissionStatus::Won, Some(&list));
        assert!(!result.is_valid());
        list.insert("dot".into());
        let result =
            validate_and_score(&solution, Some(&player), SubmissionStatus::Won, Some(&list));
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }
}
