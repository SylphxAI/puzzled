//! Deterministic Hunt generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/word-search/generator.ts`.

use serde_json::{json, Value};

use super::random::{seeded_random, shuffle_array, SeededRandom};
use super::word_search_themes::THEMES;

const GRID_SIZE: usize = 10;
const MIN_WORDS: usize = 6;
const MAX_WORDS: usize = 10;
const ALPHABET: &[char] = &[
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];
const DIRECTIONS: &[&str] = &[
    "horizontal",
    "vertical",
    "diagonal-down",
    "diagonal-up",
    "horizontal-reverse",
    "vertical-reverse",
    "diagonal-down-reverse",
    "diagonal-up-reverse",
];

fn direction_vector(direction: &str) -> (i32, i32) {
    match direction {
        "horizontal" => (0, 1),
        "vertical" => (1, 0),
        "diagonal-down" => (1, 1),
        "diagonal-up" => (-1, 1),
        "horizontal-reverse" => (0, -1),
        "vertical-reverse" => (-1, 0),
        "diagonal-down-reverse" => (-1, -1),
        "diagonal-up-reverse" => (1, -1),
        _ => (0, 0),
    }
}

struct Placement {
    word: String,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
    direction: String,
}

fn try_place_word(
    grid: &mut [Vec<char>],
    word: &str,
    random: &mut SeededRandom,
) -> Option<Placement> {
    let shuffled_directions = shuffle_array(DIRECTIONS, random);
    let chars: Vec<char> = word.chars().collect();
    for direction in shuffled_directions {
        let (d_row, d_col) = direction_vector(direction);
        let max_row = GRID_SIZE as i32 - 1 - 0.max((chars.len() as i32 - 1) * d_row.abs());
        let max_col = GRID_SIZE as i32 - 1 - 0.max((chars.len() as i32 - 1) * d_col.abs());
        let min_row = if d_row < 0 { chars.len() as i32 - 1 } else { 0 };
        let min_col = if d_col < 0 { chars.len() as i32 - 1 } else { 0 };
        if max_row < min_row || max_col < min_col {
            continue;
        }
        for _ in 0..50 {
            let start_row =
                min_row + (random.next_f64() * f64::from(max_row - min_row + 1)).floor() as i32;
            let start_col =
                min_col + (random.next_f64() * f64::from(max_col - min_col + 1)).floor() as i32;
            let mut can_place = true;
            for (index, letter) in chars.iter().enumerate() {
                let row = start_row + index as i32 * d_row;
                let col = start_col + index as i32 * d_col;
                let current = grid[row as usize][col as usize];
                if current != '\0' && current != *letter {
                    can_place = false;
                    break;
                }
            }
            if can_place {
                for (index, letter) in chars.iter().enumerate() {
                    let row = start_row + index as i32 * d_row;
                    let col = start_col + index as i32 * d_col;
                    grid[row as usize][col as usize] = *letter;
                }
                return Some(Placement {
                    word: word.to_string(),
                    start_row: start_row as usize,
                    start_col: start_col as usize,
                    end_row: (start_row + (chars.len() as i32 - 1) * d_row) as usize,
                    end_col: (start_col + (chars.len() as i32 - 1) * d_col) as usize,
                    direction: (*direction).to_string(),
                });
            }
        }
    }
    None
}

/// Generate client grid + server placements for a seed.
#[must_use]
pub fn generate_word_search_puzzle(seed: i64) -> (Value, Value) {
    let mut random = seeded_random(seed);
    let theme = &THEMES[(random.next_f64() * THEMES.len() as f64).floor() as usize];
    let shuffled_words = shuffle_array(theme.words, &mut random);
    let target_word_count =
        MIN_WORDS + (random.next_f64() * (MAX_WORDS - MIN_WORDS + 1) as f64).floor() as usize;
    let mut grid = vec![vec!['\0'; GRID_SIZE]; GRID_SIZE];
    let mut placements = Vec::new();
    let mut words = Vec::new();
    for word in shuffled_words {
        if words.len() >= target_word_count {
            break;
        }
        if word.len() > GRID_SIZE {
            continue;
        }
        if let Some(placement) = try_place_word(&mut grid, word, &mut random) {
            words.push(word.to_string());
            placements.push(placement);
        }
    }
    for row in &mut grid {
        for cell in row {
            if *cell == '\0' {
                let index = (random.next_f64() * ALPHABET.len() as f64).floor() as usize;
                *cell = ALPHABET[index];
            }
        }
    }
    let grid_json: Vec<Vec<String>> = grid
        .iter()
        .map(|row| row.iter().map(char::to_string).collect())
        .collect();
    let placements_json: Vec<Value> = placements
        .iter()
        .map(|placement| {
            json!({
                "word": placement.word,
                "start": { "row": placement.start_row, "col": placement.start_col },
                "end": { "row": placement.end_row, "col": placement.end_col },
                "direction": placement.direction,
            })
        })
        .collect();
    (
        json!({
            "grid": grid_json,
            "theme": theme.name,
            "wordCount": words.len(),
            "words": words,
        }),
        json!({
            "words": words,
            "placements": placements_json,
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(
            generate_word_search_puzzle(5),
            generate_word_search_puzzle(5)
        );
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let (data, solution) = generate_word_search_puzzle(1);
        assert_eq!(data["theme"], "Music");
        assert_eq!(data["wordCount"], 7);
        assert_eq!(
            data["words"],
            json!([
                "BASS",
                "SAXOPHONE",
                "TRUMPET",
                "MELODY",
                "CHORUS",
                "HARMONICA",
                "HARP"
            ])
        );
        assert_eq!(
            data["grid"][0]
                .as_array()
                .expect("row")
                .iter()
                .filter_map(Value::as_str)
                .collect::<String>(),
            "YHARMONICA"
        );
        assert!(data.get("placements").is_none());
        assert_eq!(solution["placements"][0]["word"], "BASS");
        assert_eq!(
            solution["placements"][0]["direction"],
            "diagonal-up-reverse"
        );

        let (data5, _) = generate_word_search_puzzle(5);
        assert_eq!(
            data5["words"],
            json!([
                "VERSE",
                "GUITAR",
                "VIOLIN",
                "BASS",
                "PIANO",
                "SAXOPHONE",
                "RHYTHM"
            ])
        );
    }
}
