//! Pure Letter Boxed validation + score — mirrors
//! `apps/puzzled/src/games/word-box/types.ts` + `config.ts#validateAndScore`.
//! PORTFOLIO residual pure deepen. NO authority_rust / ts_deleted.

use std::collections::BTreeSet;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LetterBox {
    pub top: [char; 3],
    pub right: [char; 3],
    pub bottom: [char; 3],
    pub left: [char; 3],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BoxSide {
    Top,
    Right,
    Bottom,
    Left,
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

fn upper(c: char) -> char {
    c.to_ascii_uppercase()
}

#[must_use]
pub fn get_letter_side(box_: &LetterBox, letter: char) -> Option<BoxSide> {
    let u = upper(letter);
    if box_.top.contains(&u) {
        return Some(BoxSide::Top);
    }
    if box_.right.contains(&u) {
        return Some(BoxSide::Right);
    }
    if box_.bottom.contains(&u) {
        return Some(BoxSide::Bottom);
    }
    if box_.left.contains(&u) {
        return Some(BoxSide::Left);
    }
    None
}

#[must_use]
pub fn all_letters(box_: &LetterBox) -> Vec<char> {
    let mut v = Vec::with_capacity(12);
    v.extend_from_slice(&box_.top);
    v.extend_from_slice(&box_.right);
    v.extend_from_slice(&box_.bottom);
    v.extend_from_slice(&box_.left);
    v
}

/// Word uses only letters present on the box.
#[must_use]
pub fn uses_valid_letters(box_: &LetterBox, word: &str) -> bool {
    let all = all_letters(box_);
    word.chars().map(upper).all(|l| all.contains(&l))
}

/// Consecutive letters must come from different sides.
#[must_use]
pub fn has_valid_side_transitions(box_: &LetterBox, word: &str) -> bool {
    let letters: Vec<char> = word.chars().map(upper).collect();
    if letters.len() < 2 {
        return true;
    }
    for i in 0..letters.len() - 1 {
        let a = match get_letter_side(box_, letters[i]) {
            Some(s) => s,
            None => return false,
        };
        let b = match get_letter_side(box_, letters[i + 1]) {
            Some(s) => s,
            None => return false,
        };
        if a == b {
            return false;
        }
    }
    true
}

/// New word must start with last letter of previous (empty previous → true).
#[must_use]
pub fn starts_with_last_letter(previous_word: &str, new_word: &str) -> bool {
    if previous_word.is_empty() {
        return true;
    }
    let last = previous_word.chars().last().map(upper);
    let first = new_word.chars().next().map(upper);
    last == first
}

#[must_use]
pub fn get_used_letters(words: &[&str]) -> BTreeSet<char> {
    let mut used = BTreeSet::new();
    for w in words {
        for c in w.chars() {
            used.insert(upper(c));
        }
    }
    used
}

#[must_use]
pub fn all_letters_used(box_: &LetterBox, used: &BTreeSet<char>) -> bool {
    all_letters(box_).into_iter().all(|l| used.contains(&l))
}

/// Word-count score table: ≤2→100, 3→80, 4→60, 5+→40.
#[must_use]
pub fn word_box_score(word_count: u32) -> u32 {
    if word_count <= 2 {
        100
    } else if word_count == 3 {
        80
    } else if word_count == 4 {
        60
    } else {
        40
    }
}

/// Validate claimed words cover the box (win) or accept loss; compute score.
///
/// `all_letters` is the 12-letter solution alphabet (top/right/bottom/left ×3).
#[must_use]
pub fn validate_and_score(
    all_letters: &[char],
    words: Option<&[String]>,
    claimed: SubmissionStatus,
) -> GameResult {
    if claimed == SubmissionStatus::Lost {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    let Some(words) = words else {
        return GameResult::Invalid {
            error: "Missing words data".into(),
        };
    };
    if words.is_empty() {
        return GameResult::Invalid {
            error: "Missing words data".into(),
        };
    }

    if all_letters.len() < 12 {
        return GameResult::Invalid {
            error: "Invalid solution letters".into(),
        };
    }

    let box_ = LetterBox {
        top: [all_letters[0], all_letters[1], all_letters[2]],
        right: [all_letters[3], all_letters[4], all_letters[5]],
        bottom: [all_letters[6], all_letters[7], all_letters[8]],
        left: [all_letters[9], all_letters[10], all_letters[11]],
    };

    let word_refs: Vec<&str> = words.iter().map(String::as_str).collect();
    let used = get_used_letters(&word_refs);
    if !all_letters_used(&box_, &used) {
        return GameResult::Invalid {
            error: "Not all letters used".into(),
        };
    }

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: word_box_score(words.len() as u32),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> LetterBox {
        LetterBox {
            top: ['A', 'B', 'C'],
            right: ['D', 'E', 'F'],
            bottom: ['G', 'H', 'I'],
            left: ['J', 'K', 'L'],
        }
    }

    #[test]
    fn valid_letters_and_sides() {
        let b = sample();
        assert!(uses_valid_letters(&b, "ad"));
        assert!(!uses_valid_letters(&b, "az"));
        assert!(has_valid_side_transitions(&b, "ad")); // top→right
        assert!(!has_valid_side_transitions(&b, "ab")); // same side
        assert!(starts_with_last_letter("", "ad"));
        assert!(starts_with_last_letter("ad", "dg"));
        assert!(!starts_with_last_letter("ad", "ag"));
    }

    #[test]
    fn used_and_win() {
        let b = sample();
        let used = get_used_letters(&["ABC", "DEF", "GHI", "JKL"]);
        assert_eq!(used.len(), 12);
        assert!(all_letters_used(&b, &used));
        let partial = get_used_letters(&["ABC"]);
        assert!(!all_letters_used(&b, &partial));
    }

    #[test]
    fn score_and_validate() {
        assert_eq!(word_box_score(2), 100);
        assert_eq!(word_box_score(3), 80);
        assert_eq!(word_box_score(4), 60);
        assert_eq!(word_box_score(5), 40);
        let letters: Vec<char> = "ABCDEFGHIJKL".chars().collect();
        let words = vec!["ABC".into(), "DEF".into(), "GHI".into(), "JKL".into()];
        let r = validate_and_score(&letters, Some(&words), SubmissionStatus::Won);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 60
            }
        );
        let lost = validate_and_score(&letters, None, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let incomplete = validate_and_score(&letters, Some(&["ABC".into()]), SubmissionStatus::Won);
        assert!(!incomplete.is_valid());
        let two = validate_and_score(
            &letters,
            Some(&["ABCDEF".into(), "GHIJKL".into()]),
            SubmissionStatus::Won,
        );
        assert_eq!(
            two,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }
}
