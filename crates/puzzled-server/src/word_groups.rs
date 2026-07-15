//! Word Groups (Connections) pure match + score — mirrors
//! `apps/puzzled/src/games/word-groups/config.ts`.
//!
//! FLEET residual pure deepen. NO authority_rust / ts_deleted.

/// Words per category (Connections standard).
pub const WORDS_PER_CATEGORY: usize = 4;
/// Total categories in a puzzle.
pub const TOTAL_CATEGORIES: usize = 4;
/// Max mistakes before loss.
pub const MAX_MISTAKES: u32 = 4;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Category {
    pub name: String,
    pub words: Vec<String>,
    pub level: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameResult {
    Invalid { error: String },
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

/// Case-insensitive exact multiset match of guess words to a category.
#[must_use]
pub fn find_matching_category<'a>(
    words: &[String],
    categories: &'a [Category],
) -> Option<&'a Category> {
    let word_set: std::collections::HashSet<String> =
        words.iter().map(|w| w.to_ascii_uppercase()).collect();

    categories.iter().find(|cat| {
        let cat_words: Vec<String> = cat.words.iter().map(|w| w.to_ascii_uppercase()).collect();
        cat_words.len() == word_set.len() && cat_words.iter().all(|w| word_set.contains(w))
    })
}

/// Mistake-based score for a won game: `max(0, 100 - mistakes * 25)`.
#[must_use]
pub fn word_groups_score(mistakes: u32) -> u32 {
    100u32.saturating_sub(mistakes.saturating_mul(25))
}

/// Validate found categories + claimed status; compute score.
///
/// Scoring (won only):
/// - 0 mistakes: 100
/// - 1 mistake: 75
/// - 2 mistakes: 50
/// - 3 mistakes: 25
/// - 4+ mistakes / loss: 0
#[must_use]
pub fn validate_and_score(
    categories: &[Category],
    found_categories: Option<&[Vec<String>]>,
    mistakes: Option<u32>,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(found) = found_categories else {
        return GameResult::Invalid {
            error: "Missing found categories data".into(),
        };
    };

    let valid_category_count = found
        .iter()
        .filter(|found_words| {
            found_words.len() == WORDS_PER_CATEGORY
                && find_matching_category(found_words, categories).is_some()
        })
        .count();

    let found_all = valid_category_count == TOTAL_CATEGORIES;

    if claimed == SubmissionStatus::Won && !found_all {
        return GameResult::Invalid {
            error: "Invalid win claim - not all categories found correctly".into(),
        };
    }
    if claimed == SubmissionStatus::Lost && found_all {
        return GameResult::Invalid {
            error: "Invalid loss claim - all categories found correctly".into(),
        };
    }

    if !found_all {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    let mistakes = mistakes.unwrap_or(0);
    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: word_groups_score(mistakes),
    }
}

/// Max matching words against any unsolved category ("one away" helper).
#[must_use]
pub fn count_matching_words(
    selected: &[String],
    categories: &[Category],
    solved_names: &[String],
) -> usize {
    let solved: std::collections::HashSet<String> = solved_names
        .iter()
        .map(|n| n.to_ascii_uppercase())
        .collect();
    let selected_upper: Vec<String> = selected.iter().map(|w| w.to_ascii_uppercase()).collect();

    let mut max_matching = 0usize;
    for cat in categories {
        if solved.contains(&cat.name.to_ascii_uppercase()) {
            continue;
        }
        let cat_words: std::collections::HashSet<String> =
            cat.words.iter().map(|w| w.to_ascii_uppercase()).collect();
        let matching = selected_upper
            .iter()
            .filter(|w| cat_words.contains(*w))
            .count();
        max_matching = max_matching.max(matching);
    }
    max_matching
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_categories() -> Vec<Category> {
        vec![
            Category {
                name: "Fruits".into(),
                words: vec![
                    "APPLE".into(),
                    "BANANA".into(),
                    "CHERRY".into(),
                    "DATE".into(),
                ],
                level: 0,
            },
            Category {
                name: "Colors".into(),
                words: vec![
                    "RED".into(),
                    "BLUE".into(),
                    "GREEN".into(),
                    "YELLOW".into(),
                ],
                level: 1,
            },
            Category {
                name: "Animals".into(),
                words: vec!["DOG".into(), "CAT".into(), "BIRD".into(), "FISH".into()],
                level: 2,
            },
            Category {
                name: "Numbers".into(),
                words: vec![
                    "ONE".into(),
                    "TWO".into(),
                    "THREE".into(),
                    "FOUR".into(),
                ],
                level: 3,
            },
        ]
    }

    fn all_found(cats: &[Category]) -> Vec<Vec<String>> {
        cats.iter().map(|c| c.words.clone()).collect()
    }

    #[test]
    fn match_is_case_insensitive_and_order_free() {
        let cats = sample_categories();
        let guess = vec![
            "date".into(),
            "apple".into(),
            "banana".into(),
            "cherry".into(),
        ];
        let matched = find_matching_category(&guess, &cats);
        assert!(matched.is_some());
        assert_eq!(matched.map(|c| c.name.as_str()), Some("Fruits"));
    }

    #[test]
    fn partial_guess_not_match() {
        let cats = sample_categories();
        let guess = vec![
            "APPLE".into(),
            "BANANA".into(),
            "CHERRY".into(),
            "RED".into(),
        ];
        assert!(find_matching_category(&guess, &cats).is_none());
    }

    #[test]
    fn score_table() {
        assert_eq!(word_groups_score(0), 100);
        assert_eq!(word_groups_score(1), 75);
        assert_eq!(word_groups_score(2), 50);
        assert_eq!(word_groups_score(3), 25);
        assert_eq!(word_groups_score(4), 0);
    }

    #[test]
    fn perfect_win() {
        let cats = sample_categories();
        let found = all_found(&cats);
        let result = validate_and_score(
            &cats,
            Some(&found),
            Some(0),
            SubmissionStatus::Won,
        );
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }

    #[test]
    fn three_mistakes_scores_25() {
        let cats = sample_categories();
        let found = all_found(&cats);
        let result = validate_and_score(
            &cats,
            Some(&found),
            Some(3),
            SubmissionStatus::Won,
        );
        assert_eq!(
            result,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 25
            }
        );
    }

    #[test]
    fn false_win_claim_rejected() {
        let cats = sample_categories();
        let found = vec![cats[0].words.clone()];
        let result = validate_and_score(
            &cats,
            Some(&found),
            Some(0),
            SubmissionStatus::Won,
        );
        assert!(!result.is_valid());
    }

    #[test]
    fn loss_when_not_all_found() {
        let cats = sample_categories();
        let found = vec![cats[0].words.clone(), cats[1].words.clone()];
        let result = validate_and_score(
            &cats,
            Some(&found),
            Some(4),
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
    fn one_away_count() {
        let cats = sample_categories();
        let selected = vec![
            "APPLE".into(),
            "BANANA".into(),
            "CHERRY".into(),
            "RED".into(),
        ];
        assert_eq!(count_matching_words(&selected, &cats, &[]), 3);
    }
}
