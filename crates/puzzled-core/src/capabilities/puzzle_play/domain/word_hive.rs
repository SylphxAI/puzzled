//! Pure word-hive (spelling bee) scoring + validateAndScore — mirrors
//! `apps/puzzled/src/games/word-hive/types.ts` + `config.ts#validateAndScore`.
//! PORTFOLIO residual pure deepen. NO authority_rust / ts_deleted.

use std::collections::HashSet;

/// Minimum accepted word length (MIN_WORD_LENGTH).
pub const MIN_WORD_LENGTH: usize = 4;

/// Spelling-bee rank labels ordered by threshold ascending.
pub const RANK_THRESHOLDS: &[(&str, f64)] = &[
    ("beginner", 0.0),
    ("good", 8.0),
    ("solid", 15.0),
    ("nice", 25.0),
    ("great", 40.0),
    ("amazing", 50.0),
    ("genius", 70.0),
    ("queen-bee", 100.0),
];

/// Score for a submitted word.
#[must_use]
pub fn calculate_word_score(word: &str, is_pangram: bool) -> u32 {
    if word.len() == 4 {
        return 1;
    }
    let base = word.len() as u32;
    if is_pangram {
        base.saturating_add(7)
    } else {
        base
    }
}

/// Rank label for a score against maxScore (percentage thresholds).
#[must_use]
pub fn get_rank_for_score(score: u32, max_score: u32) -> &'static str {
    let percentage = if max_score > 0 {
        (f64::from(score) / f64::from(max_score)) * 100.0
    } else {
        0.0
    };
    let mut current = "beginner";
    for (rank, threshold) in RANK_THRESHOLDS {
        if percentage >= *threshold {
            current = rank;
        }
    }
    current
}

/// Next rank threshold and points needed, or None if already at max.
#[must_use]
pub fn get_next_rank_threshold(score: u32, max_score: u32) -> Option<(&'static str, u32)> {
    let percentage = if max_score > 0 {
        (f64::from(score) / f64::from(max_score)) * 100.0
    } else {
        0.0
    };
    for (rank, threshold) in RANK_THRESHOLDS {
        if percentage < *threshold {
            let points_needed = ((*threshold / 100.0) * f64::from(max_score)).ceil() as u32;
            let needed = points_needed.saturating_sub(score);
            return Some((rank, needed));
        }
    }
    None
}

/// One-letter ladder step: same length, exactly one char differs.
#[must_use]
pub fn is_one_letter_change(word1: &str, word2: &str) -> bool {
    if word1.len() != word2.len() {
        return false;
    }
    let mut differences = 0u32;
    for (a, b) in word1.chars().zip(word2.chars()) {
        if a != b {
            differences += 1;
            if differences > 1 {
                return false;
            }
        }
    }
    differences == 1
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameResult {
    Invalid { error: String },
    Valid { status: &'static str, score: u32 },
}

impl GameResult {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        matches!(self, Self::Valid { .. })
    }
}

/// Sum word scores for claimed found words; every word must be in `valid_words`.
/// Spelling Bee always completes as `"won"` (ranks determine quality).
#[must_use]
pub fn validate_and_score(
    valid_words: &HashSet<String>,
    pangrams: &HashSet<String>,
    found_words: Option<&[String]>,
) -> GameResult {
    let Some(found) = found_words else {
        return GameResult::Invalid {
            error: "Missing found words data".into(),
        };
    };

    let mut score = 0u32;
    for word in found {
        let upper = word.to_ascii_uppercase();
        if !valid_words.contains(&upper) {
            return GameResult::Invalid {
                error: format!("Invalid word claim: {word}"),
            };
        }
        let is_pangram = pangrams.contains(&upper);
        score = score.saturating_add(calculate_word_score(&upper, is_pangram));
    }

    GameResult::Valid {
        status: "won",
        score,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_score_table() {
        assert_eq!(calculate_word_score("test", false), 1);
        assert_eq!(calculate_word_score("tests", false), 5);
        assert_eq!(calculate_word_score("testing", true), 7 + 7);
        assert_eq!(calculate_word_score("abcde", true), 5 + 7);
    }

    #[test]
    fn ranks() {
        assert_eq!(get_rank_for_score(0, 100), "beginner");
        assert_eq!(get_rank_for_score(8, 100), "good");
        assert_eq!(get_rank_for_score(70, 100), "genius");
        assert_eq!(get_rank_for_score(100, 100), "queen-bee");
        assert_eq!(get_rank_for_score(0, 0), "beginner");
    }

    #[test]
    fn next_rank() {
        let n = get_next_rank_threshold(0, 100).unwrap_or_else(|| panic!("threshold"));
        assert_eq!(n.0, "good");
        assert_eq!(n.1, 8);
        assert!(get_next_rank_threshold(100, 100).is_none());
    }

    #[test]
    fn one_letter() {
        assert!(is_one_letter_change("cold", "cord"));
        assert!(!is_one_letter_change("cold", "warm"));
        assert!(!is_one_letter_change("cold", "colder"));
        assert!(!is_one_letter_change("cold", "cold"));
    }

    #[test]
    fn validate_sum_and_reject() {
        let valid: HashSet<String> = ["TEST", "TESTS", "TESTING"]
            .into_iter()
            .map(str::to_string)
            .collect();
        let pangrams: HashSet<String> = ["TESTING"].into_iter().map(str::to_string).collect();
        let found = vec!["test".into(), "testing".into()];
        let r = validate_and_score(&valid, &pangrams, Some(&found));
        // test=1, testing pangram=7+7=14 → 15
        assert_eq!(
            r,
            GameResult::Valid {
                status: "won",
                score: 15
            }
        );
        let bad = validate_and_score(&valid, &pangrams, Some(&["nope".into()]));
        assert!(!bad.is_valid());
        let missing = validate_and_score(&valid, &pangrams, None);
        assert!(!missing.is_valid());
    }
}
