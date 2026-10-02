//! Mini-crossword generator V2 (`rust-crossword-v2`): word squares whose
//! column clues describe the column words.
//!
//! V1 (`crossword_generate::generate_crossword_puzzle`) stays frozen: its
//! stored rows are never replaced, and its pool pairs each row word with a
//! "down" clue that is only right when the column spells the same word. V2 keeps
//! the same 5x5 shape, numbering and scoring but builds the clues from the
//! actual rows and columns:
//!
//! - every row and every column is a common word (the word-guess solution list;
//!   checked by a test);
//! - across clues are the row words' first clue, down clues the column words'
//!   second clue, so a word that is both a row and a column (symmetric squares)
//!   always gets two different clues;
//! - a word is unique within each direction; the same word may appear across
//!   and down;
//! - `puzzle_data.clueSet == "rows-columns"` marks the payload.

use serde_json::{json, Value};

use super::crossword_grid::CROSSWORD_GRID_SIZE;

/// Marker on V2 `puzzle_data`: down clues describe the column words.
pub const CLUE_SET_ROWS_COLUMNS: &str = "rows-columns";

/// (word, across clue, down clue)
const CLUES: &[(&str, &str, &str)] = &[
    ("ABASE", "Humiliate", "Degrade"),
    ("ABIDE", "Put up with", "Stay or dwell"),
    ("ABOVE", "Over the top of", "Higher than"),
    ("ADORE", "Love deeply", "Worship"),
    ("AGAPE", "Open-mouthed in awe", "Wide open, as a mouth"),
    ("ALIVE", "Living", "Not dead"),
    ("APART", "Not together", "Separated by distance"),
    (
        "APNEA",
        "Pauses in breathing during sleep",
        "Sleep disorder with snoring",
    ),
    ("ARENA", "Sports venue", "Stadium"),
    ("ARISE", "Wake up", "Get up"),
    ("ASHEN", "Pale gray", "Ghost-like color"),
    ("ASSET", "Valuable item", "Resource"),
    ("ATTIC", "Storage room", "Upper floor"),
    ("AVERT", "Turn away", "Prevent"),
    (
        "BEECH",
        "Tree with smooth gray bark",
        "Hardwood used in furniture",
    ),
    ("BLAME", "Fault", "Accuse"),
    ("BLOAT", "Swell up", "Puff up with gas"),
    ("BRIBE", "Payoff for a favor", "Illicit sweetener"),
    ("CARAT", "Gem weight unit", "Diamond measure"),
    ("CHEST", "Treasure box", "Part of the body with ribs"),
    ("CRATE", "Shipping box", "Wooden box"),
    ("CURSE", "Hex", "Swear word"),
    ("DATUM", "Single piece of information", "Singular of data"),
    ("DENIM", "Jean fabric", "Jeans material"),
    ("EATEN", "Consumed", "Having had dinner, say"),
    ("EATER", "One who consumes", "Diner"),
    ("ELATE", "Make happy", "Thrill"),
    ("ELOPE", "Run off to wed", "Marry in secret"),
    ("EMBER", "Glowing coal", "Hot ash"),
    ("ENEMY", "Foe", "Opposing force"),
    ("ENTER", "Come in", "Go inside"),
    ("ENTRY", "Doorway", "Way in"),
    ("ERASE", "Delete", "Wipe out"),
    ("ERODE", "Wear away", "Gradually eat into"),
    ("ERROR", "Mistake", "Bug"),
    ("EVADE", "Avoid", "Dodge"),
    ("FORUM", "Place for public discussion", "Roman marketplace"),
    ("FRAME", "Border for a picture", "Set up, as a suspect"),
    ("GOING", "Departing", "Moving along"),
    ("GRAPE", "Wine fruit", "Vineyard fruit"),
    ("HAREM", "Wives quarters", "Palace section"),
    ("HARSH", "Severe", "Rough and unpleasant"),
    ("HASTE", "Great speed", "Rush that makes waste"),
    ("HAVEN", "Safe place", "Harbor"),
    ("HEAVE", "Lift with effort", "Throw with a grunt"),
    ("HOVER", "Float", "Stay aloft"),
    ("INERT", "Lacking motion", "Chemically inactive"),
    ("LARGE", "Big", "Oversized"),
    ("LEAST", "Smallest amount", "Opposite of most"),
    ("LEGAL", "Lawful", "By the law"),
    ("MELEE", "Brawl", "Fight"),
    ("MERGE", "Join together", "Combine, as two lanes"),
    ("MOLAR", "Grinding tooth", "Back chewer"),
    ("NAIVE", "Innocent", "Gullible"),
    ("OBESE", "Very overweight", "Heavy"),
    ("ONSET", "Beginning", "Start"),
    ("OPERA", "Sung drama", "Where a diva performs"),
    ("OPINE", "Offer a view", "Express a thought"),
    ("ORGAN", "Musical instrument", "Piano or pipe"),
    ("OVERT", "Done openly", "Not hidden"),
    ("OVINE", "Sheeplike", "Like a lamb"),
    ("PANEL", "Discussion group", "Flat section"),
    ("PASTE", "Glue", "Adhesive"),
    ("PIECE", "Part of a whole", "Chess item"),
    ("PROVE", "Show to be true", "Demonstrate"),
    ("PURER", "Less contaminated", "More unmixed"),
    ("RAISE", "Lift up", "Pay increase"),
    ("RAMEN", "Noodle soup", "Instant noodle brand type"),
    ("RATTY", "Shabby", "Run-down and worn"),
    ("RAVEN", "Black bird", "Poe bird"),
    ("REGAL", "Royal", "Kingly"),
    ("REHAB", "Recovery program", "Restore, as a building"),
    ("RELAY", "Race with a baton", "Pass along, as news"),
    ("RESIN", "Tree secretion", "Pine product"),
    ("RIPEN", "Mature", "Get ready"),
    ("ROBIN", "Red-breasted songbird", "Batman sidekick"),
    ("ROYAL", "Fit for a king", "Like a crown prince"),
    ("SALON", "Beauty parlor", "Hair studio"),
    ("SCARE", "Frighten", "Spook"),
    ("SCOUT", "Look ahead for talent", "Boy or Girl, perhaps"),
    ("SEDAN", "Four-door car", "Family car type"),
    ("SEVEN", "Lucky number", "One more than six"),
    ("SHAME", "Disgrace", "Feeling of guilt"),
    ("SHIRT", "Button-up top", "Part of a suit and tie"),
    ("SHUNT", "Divert to another track", "Move aside"),
    ("SNORT", "Pig sound", "Disdainful sniff"),
    ("SONIC", "Relating to sound", "Faster than a plane, maybe"),
    ("TEETH", "Chompers", "Dentist's focus"),
    ("TENET", "Core belief", "Guiding principle"),
    ("TENOR", "High male singer", "General tone or drift"),
    ("TENTH", "One part in ten", "Decimal place after ninth"),
    ("TERSE", "Brief and to the point", "Concise"),
    ("THETA", "Greek letter", "Greek T"),
    ("TIDAL", "Wave-related", "Ocean pattern"),
    ("TRACE", "Follow", "Small amount"),
    ("TREND", "Fashion direction", "Popular style"),
    ("UMBRA", "Darkest part of a shadow", "Total eclipse shadow"),
    ("USAGE", "Way of using words", "How a term is employed"),
    ("VALOR", "Great courage", "Bravery in battle"),
    ("VAPOR", "Misty gas", "Steam, for one"),
    ("VENOM", "Snake poison", "Spite, figuratively"),
    ("VERGE", "Edge", "On the brink"),
    ("WHEAT", "Bread grain", "Crop in a Kansas field"),
    ("YEAST", "Dough riser", "Brewer's helper"),
    ("ZEBRA", "Striped animal", "Safari animal"),
];

/// Boards as row words; the column words are read from the rows.
const BOARDS: &[[&str; 5]] = &[
    ["CRATE", "RAVEN", "AVERT", "TERSE", "ENTER"],
    ["PASTE", "ASHEN", "SHIRT", "TERSE", "ENTER"],
    ["GRAPE", "RESIN", "ASSET", "PIECE", "ENTER"],
    ["HAREM", "ADORE", "ROYAL", "ERASE", "MELEE"],
    ["WHEAT", "HARSH", "ERASE", "ASSET", "THETA"],
    ["ZEBRA", "ERROR", "BRIBE", "ROBIN", "ARENA"],
    ["CARAT", "ADORE", "ROBIN", "ARISE", "TENET"],
    ["CARAT", "ALIVE", "RIPEN", "AVERT", "TENTH"],
    ["CARAT", "ABASE", "RAISE", "ASSET", "TEETH"],
    ["YEAST", "ERROR", "ARENA", "SONIC", "TRACE"],
    ["YEAST", "EMBER", "ABOVE", "SEVEN", "TREND"],
    ["SHAME", "HAVEN", "AVERT", "MERGE", "ENTER"],
    ["FRAME", "RIPEN", "APART", "MERGE", "ENTER"],
    ["APART", "PURER", "ARISE", "RESIN", "TREND"],
    ["CHEST", "HOVER", "EVADE", "SEDAN", "TREND"],
    ["LEAST", "EMBER", "ABIDE", "SEDAN", "TREND"],
    ["VALOR", "ARENA", "LEAST", "ONSET", "RATTY"],
    ["BLOAT", "LARGE", "ORGAN", "AGAPE", "TENET"],
    ["ASSET", "SCARE", "SALON", "ERODE", "TENET"],
    ["ERODE", "RIPEN", "OPINE", "DENIM", "ENEMY"],
    ["WHEAT", "HEAVE", "EATEN", "AVERT", "TENTH"],
    ["DATUM", "ARISE", "TIDAL", "USAGE", "MELEE"],
    ["FORUM", "OBESE", "REGAL", "USAGE", "MELEE"],
    ["SCOUT", "CURSE", "ORGAN", "USAGE", "TENET"],
    ["PASTE", "ASHEN", "SHUNT", "TENOR", "ENTRY"],
    ["REHAB", "ELATE", "HASTE", "ATTIC", "BEECH"],
    ["HASTE", "APNEA", "SNORT", "TERSE", "EATER"],
    ["NAIVE", "APNEA", "INERT", "VERGE", "EATEN"],
    ["REGAL", "ELOPE", "GOING", "APNEA", "LEGAL"],
    ["PROVE", "RAVEN", "OVERT", "VERGE", "ENTER"],
    ["PROVE", "RAVEN", "OVINE", "VENOM", "ENEMY"],
    ["HOVER", "OPERA", "VENOM", "ERODE", "RAMEN"],
    ["VAPOR", "AGAPE", "PANEL", "OPERA", "RELAY"],
    ["UMBRA", "MOLAR", "BLAME", "RAMEN", "ARENA"],
];

/// Count of V2 boards available for seed selection.
#[must_use]
pub fn board_count() -> usize {
    BOARDS.len()
}

fn clue_for(word: &str, down: bool) -> &'static str {
    CLUES
        .iter()
        .find(|(w, _, _)| *w == word)
        .map(|(_, across, down_clue)| if down { *down_clue } else { *across })
        .unwrap_or_else(|| panic!("crossword v2: no clue for {word}"))
}

fn column_word(rows: &[&str; 5], col: usize) -> String {
    rows.iter().map(|row| row.as_bytes()[col] as char).collect()
}

/// V2 puzzle_data + solution for a seed. Same wire shape as V1 plus the
/// `clueSet` marker; down clues describe the column words.
#[must_use]
pub fn generate_crossword_puzzle_v2(seed: i64) -> (Value, Value) {
    let rows = &BOARDS[seed.unsigned_abs() as usize % BOARDS.len()];

    let client_grid: Vec<Vec<Value>> = (0..CROSSWORD_GRID_SIZE)
        .map(|_| vec![Value::String(String::new()); CROSSWORD_GRID_SIZE])
        .collect();
    let solution_grid: Vec<Vec<Value>> = rows
        .iter()
        .map(|row| row.chars().map(|c| Value::String(c.to_string())).collect())
        .collect();

    let across: Vec<Value> = rows
        .iter()
        .enumerate()
        .map(|(row, word)| {
            json!({
                "number": if row == 0 { 1 } else { row + 5 },
                "clue": clue_for(word, false),
                "row": row,
                "col": 0,
                "length": word.len(),
            })
        })
        .collect();
    let down: Vec<Value> = (0..CROSSWORD_GRID_SIZE)
        .map(|col| {
            let word = column_word(rows, col);
            json!({
                "number": col + 1,
                "clue": clue_for(&word, true),
                "row": 0,
                "col": col,
                "length": word.len(),
            })
        })
        .collect();

    let puzzle_data = json!({
        "grid": client_grid,
        "clues": { "across": across, "down": down },
        "clueSet": CLUE_SET_ROWS_COLUMNS,
    });
    (puzzle_data, json!({ "grid": solution_grid }))
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::super::word_guess_generate::is_solution_word;
    use super::*;

    #[test]
    fn pool_has_at_least_34_boards() {
        assert!(board_count() >= 34);
    }

    #[test]
    fn every_row_and_column_is_a_common_word_unique_within_its_direction() {
        let mut seen_boards = HashSet::new();
        for rows in BOARDS {
            assert!(seen_boards.insert(*rows), "duplicate board {rows:?}");
            let cols: Vec<String> = (0..5).map(|c| column_word(rows, c)).collect();
            for word in rows
                .iter()
                .map(|w| w.to_string())
                .chain(cols.iter().cloned())
            {
                assert_eq!(word.len(), 5, "{word}");
                assert!(
                    is_solution_word(&word),
                    "{word} is not a common word ({rows:?})"
                );
            }
            let row_set: HashSet<_> = rows.iter().collect();
            let col_set: HashSet<_> = cols.iter().collect();
            assert_eq!(row_set.len(), 5, "repeated row word in {rows:?}");
            assert_eq!(col_set.len(), 5, "repeated column word in {rows:?}");
        }
    }

    #[test]
    fn every_down_clue_describes_its_column_and_differs_from_the_across_clue() {
        for seed in 0..board_count() as i64 {
            let (pd, sol) = generate_crossword_puzzle_v2(seed);
            assert_eq!(pd["clueSet"], CLUE_SET_ROWS_COLUMNS);
            let rows = &BOARDS[seed as usize];
            let down = pd["clues"]["down"].as_array().expect("down");
            let across = pd["clues"]["across"].as_array().expect("across");
            assert_eq!((down.len(), across.len()), (5, 5));
            let mut seen = HashSet::new();
            for (col, clue) in down.iter().enumerate() {
                let word = column_word(rows, col);
                assert_eq!(clue["clue"], clue_for(&word, true), "seed {seed} col {col}");
                for (row, a) in across.iter().enumerate() {
                    if rows[row] == word {
                        assert_ne!(a["clue"], clue["clue"], "seed {seed}: {word} same clue");
                    }
                }
            }
            for clue in across.iter().chain(down.iter()) {
                let text = clue["clue"].as_str().expect("clue text");
                assert!(!text.is_empty());
                seen.insert(text.to_string());
            }
            // No clue gives its answer away.
            for (row, a) in across.iter().enumerate() {
                let text = a["clue"].as_str().unwrap_or_default().to_ascii_uppercase();
                assert!(
                    !text.contains(rows[row]),
                    "seed {seed}: clue gives {}",
                    rows[row]
                );
            }
            for (col, d) in down.iter().enumerate() {
                let text = d["clue"].as_str().unwrap_or_default().to_ascii_uppercase();
                assert!(
                    !text.contains(&column_word(rows, col)),
                    "seed {seed}: down clue gives answer"
                );
            }
            // Ten clues on a board, all different.
            assert_eq!(
                seen.len(),
                10,
                "seed {seed}: duplicate clue text on one board"
            );
            let grid = sol["grid"].as_array().expect("grid");
            assert_eq!(grid[0][0].as_str(), rows[0].get(0..1));
            assert!(!pd.to_string().contains("\"answer\""));
        }
    }

    #[test]
    fn seed_is_deterministic_and_selects_by_modulo() {
        assert_eq!(
            generate_crossword_puzzle_v2(956),
            generate_crossword_puzzle_v2(956)
        );
        let n = board_count() as i64;
        assert_eq!(
            generate_crossword_puzzle_v2(3),
            generate_crossword_puzzle_v2(3 + n)
        );
        assert_eq!(
            generate_crossword_puzzle_v2(-3),
            generate_crossword_puzzle_v2(3)
        );
    }
}
