//! Pure Letter Boxed validation — mirrors
//! `apps/puzzled/src/games/word-box/types.ts`.
//! FLEET-BULK pure residual. NO authority_rust / ts_deleted.

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
    word.chars()
        .map(upper)
        .all(|l| all.contains(&l))
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
}
