//! Pure word-search found-words claim + score — mirrors
//! `apps/puzzled/src/games/word-search/config.ts#validateAndScore`.
//! PORTFOLIO residual pure deepen. NO authority_rust / ts_deleted.

/// Base win score.
pub const BASE_WIN_SCORE: u32 = 500;
/// Floor win score.
pub const MIN_WIN_SCORE: u32 = 100;

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

/// Score: `max(100, 500 - floor(seconds/2))`.
#[must_use]
pub fn word_search_score(time_spent_ms: u64) -> u32 {
    let seconds = time_spent_ms / 1000;
    let time_penalty = (seconds / 2) as u32;
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .max(MIN_WIN_SCORE)
}

/// Validate found-words claim against solution word list; score full finds.
#[must_use]
pub fn validate_and_score(
    solution_words: &[String],
    found_words: Option<&[String]>,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(found) = found_words else {
        return GameResult::Invalid {
            error: "Missing found words data".into(),
        };
    };

    for word in found {
        if !solution_words.iter().any(|w| w == word) {
            return GameResult::Invalid {
                error: format!("Invalid word: {word}"),
            };
        }
    }

    let found_all = found.len() == solution_words.len();

    if claimed == SubmissionStatus::Won && !found_all {
        return GameResult::Invalid {
            error: "Invalid win claim - not all words found".into(),
        };
    }
    if claimed == SubmissionStatus::Lost && found_all {
        return GameResult::Invalid {
            error: "Invalid loss claim - all words found".into(),
        };
    }

    if !found_all {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: word_search_score(time_spent_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(ws: &[&str]) -> Vec<String> {
        ws.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn score_table_matches_ts() {
        assert_eq!(word_search_score(0), 500);
        assert_eq!(word_search_score(100_000), 450);
        assert_eq!(word_search_score(200_000), 400);
        assert_eq!(word_search_score(2_000_000), 100);
    }

    #[test]
    fn validate_found_words() {
        let sol = words(&["CAT", "DOG", "BIRD"]);
        let all = words(&["CAT", "DOG", "BIRD"]);
        let win = validate_and_score(&sol, Some(&all), 0, SubmissionStatus::Won);
        assert_eq!(
            win,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
        let partial = words(&["CAT"]);
        let lost = validate_and_score(&sol, Some(&partial), 60_000, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let false_win = validate_and_score(&sol, Some(&partial), 0, SubmissionStatus::Won);
        assert!(!false_win.is_valid());
        let false_loss = validate_and_score(&sol, Some(&all), 0, SubmissionStatus::Lost);
        assert!(!false_loss.is_valid());
        let bad_word = words(&["CAT", "XYZ"]);
        let inv = validate_and_score(&sol, Some(&bad_word), 0, SubmissionStatus::Lost);
        assert!(!inv.is_valid());
        let missing = validate_and_score(&sol, None, 0, SubmissionStatus::Won);
        assert!(!missing.is_valid());
    }
}
