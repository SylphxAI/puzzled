//! Deterministic mini-crossword generator (free-floor fallback).
//!
//! Mirrors `apps/puzzled/src/games/crossword/generator.ts` + `config.ts#generatePuzzle`.
//! Used when the content store has no row for the day — same pattern as sudoku
//! on-server generation (RITUAL-AND-MODULE-PROTOCOL allowed deterministic fallback).
//!
//! Skips the one malformed 6-letter "ERMINE" entry from the TS pool (34 of 35).

use serde_json::{json, Value};

use super::crossword_grid::CROSSWORD_GRID_SIZE;

struct WordSquare {
    words: [&'static str; 5],
    across: [&'static str; 5],
    down: [&'static str; 5],
}

// 34 word squares ported from apps/puzzled/src/games/crossword/generator.ts
const WORD_SQUARES: &[WordSquare] = &[
    WordSquare {
        words: ["HEART", "EMBER", "ABUSE", "RESIN", "TREND"],
        across: ["Vital organ", "Glowing coal", "Mistreat", "Tree secretion", "Fashion direction"],
        down: ["Center of love", "Hot ash", "Misuse", "Pine product", "Popular style"],
    },
    WordSquare {
        words: ["STARE", "TAXES", "AXIAL", "REEDS", "ESSAY"],
        across: ["Gaze intently", "Government levies", "Along an axis", "Marsh plants", "Written composition"],
        down: ["Look fixedly", "April payments", "Rotational", "Swamp grass", "Short paper"],
    },
    WordSquare {
        words: ["SCAMP", "CADRE", "ADMIT", "TRITE", "PEEPS"],
        across: ["Rascal", "Core group", "Confess", "Overused", "Quick looks"],
        down: ["Mischievous one", "Elite unit", "Allow entry", "Clichéd", "Baby chicks"],
    },
    WordSquare {
        words: ["FLAME", "LIVER", "AVIAN", "MEDAL", "EARNS"],
        across: ["Fire tongue", "Organ that detoxifies", "Bird-related", "Award disk", "Makes money"],
        down: ["Blaze", "Vital organ", "Feathered", "Prize", "Deserves"],
    },
    WordSquare {
        words: ["STEAM", "TERSE", "ERASE", "ASHEN", "MENUS"],
        across: ["Water vapor", "Brief and to the point", "Delete", "Pale gray", "Restaurant lists"],
        down: ["Hot mist", "Concise", "Wipe out", "Ghost-like color", "Food offerings"],
    },
    WordSquare {
        words: ["CRISP", "REGAL", "IGLOO", "SALON", "PONDS"],
        across: ["Crunchy", "Royal", "Ice house", "Beauty parlor", "Small lakes"],
        down: ["Fresh and firm", "Kingly", "Eskimo home", "Hair studio", "Duck habitats"],
    },
    WordSquare {
        words: ["PASTE", "ALARM", "SALES", "TREND", "ESSAY"],
        across: ["Glue", "Warning", "Store events", "Fashion movement", "Written work"],
        down: ["Adhesive", "Clock buzzer", "Discount events", "Popular direction", "Paper"],
    },
    WordSquare {
        words: ["SHARE", "HAREM", "ARENA", "REALM", "ENEMA"],
        across: ["Portion", "Wives quarters", "Sports venue", "Kingdom", "Medical flush"],
        down: ["Split", "Palace section", "Stadium", "Domain", "Cleansing procedure"],
    },
    WordSquare {
        words: ["SMART", "MEDIA", "ADORE", "RIPEN", "TEENS"],
        across: ["Intelligent", "News sources", "Love deeply", "Mature", "Adolescents"],
        down: ["Clever", "TV and news", "Worship", "Get ready", "Young adults"],
    },
    WordSquare {
        words: ["TRADE", "RIDER", "AIMED", "DETER", "ERASE"],
        across: ["Exchange", "Horse jockey", "Pointed at", "Discourage", "Delete"],
        down: ["Swap", "Motorcycle user", "Targeted", "Prevent", "Wipe clean"],
    },
    WordSquare {
        words: ["STALE", "TONER", "ANGEL", "LEGAL", "ERASE"],
        across: ["Not fresh", "Printer ink", "Heavenly being", "Lawful", "Remove"],
        down: ["Old bread", "Copy machine supply", "Guardian spirit", "By the law", "Delete"],
    },
    WordSquare {
        words: ["CRANE", "RAVEN", "AVANT", "NEEDY", "ENTRY"],
        across: ["Construction lift", "Black bird", "Cutting-edge", "In want", "Doorway"],
        down: ["Tall bird", "Poe bird", "Forward-thinking", "Poor", "Way in"],
    },
    WordSquare {
        words: ["GRAPE", "RIVER", "AVERT", "PERKY", "ENTRY"],
        across: ["Wine fruit", "Flowing water", "Turn away", "Cheerful", "Doorway"],
        down: ["Vineyard fruit", "Stream", "Prevent", "Upbeat", "Entrance"],
    },
    WordSquare {
        words: ["TRACE", "RANCH", "ANVIL", "CHINA", "ELATE"],
        across: ["Follow", "Farm", "Blacksmith tool", "Asian country", "Make happy"],
        down: ["Small amount", "Cattle farm", "Metal shaper", "Porcelain", "Thrill"],
    },
    WordSquare {
        words: ["BLAME", "LASER", "ASSET", "METER", "ERRED"],
        across: ["Fault", "Light beam", "Valuable item", "Measuring device", "Made mistake"],
        down: ["Accuse", "Surgery tool", "Resource", "Parking ___", "Goofed"],
    },
    WordSquare {
        words: ["SHAKE", "HAVEN", "AVAIL", "KELPS", "ENSUE"],
        across: ["Tremble", "Safe place", "Use", "Seaweeds", "Follow"],
        down: ["Quiver", "Harbor", "Benefit", "Ocean plants", "Result"],
    },
    WordSquare {
        words: ["CRATE", "RIPER", "AISLE", "TEENS", "ERECT"],
        across: ["Shipping box", "More mature", "Store lane", "Young people", "Build up"],
        down: ["Wooden box", "Ready to eat", "Grocery path", "Adolescents", "Upright"],
    },
    WordSquare {
        words: ["STORM", "TORSO", "ORGAN", "RANGE", "MONEY"],
        across: ["Bad weather", "Body trunk", "Musical instrument", "Mountain chain", "Currency"],
        down: ["Tempest", "Upper body", "Piano or pipe", "Stove", "Cash"],
    },
    WordSquare {
        words: ["BREAD", "RENAL", "ENTER", "ALIEN", "DRESS"],
        across: ["Bakery item", "Kidney-related", "Come in", "Foreigner", "Garment"],
        down: ["Loaf", "Organ type", "Go inside", "ET", "Outfit"],
    },
    WordSquare {
        words: ["SPEND", "PLAZA", "EATER", "NASAL", "DARTS"],
        across: ["Use money", "Town square", "One who consumes", "Nose-related", "Pub game pieces"],
        down: ["Shell out", "Shopping center", "Diner", "Sinus area", "Pointed missiles"],
    },
    WordSquare {
        words: ["MAPLE", "ALIAS", "PINTO", "LITRE", "ESSAY"],
        across: ["Syrup tree", "Fake name", "Spotted horse", "Metric volume", "Paper"],
        down: ["Leaf shape", "Stage name", "Bean type", "Liter spelling", "Composition"],
    },
    WordSquare {
        words: ["SCALE", "CEDAR", "ADEPT", "LARGE", "ERTES"],
        across: ["Weighing device", "Fragrant wood", "Skilled", "Big", "Art style"],
        down: ["Climb", "Closet wood", "Expert", "Oversized", "Deco artist"],
    },
    WordSquare {
        words: ["STAIN", "TIARA", "ABASE", "IRENE", "NAVEL"],
        across: ["Spot mark", "Crown", "Humiliate", "Greek goddess", "Belly button"],
        down: ["Blemish", "Princess crown", "Degrade", "Peace goddess", "Orange type"],
    },
    WordSquare {
        words: ["SWORN", "WAGER", "ORDER", "RERUN", "NERDY"],
        across: ["Under oath", "Bet", "Command", "TV repeat", "Geeky"],
        down: ["Pledged", "Gamble", "Sequence", "Replay", "Bookish"],
    },
    WordSquare {
        words: ["CAPER", "ALIVE", "PIPER", "EVERY", "REYES"],
        across: ["Heist", "Living", "Flute player", "Each one", "Spanish kings"],
        down: ["Adventure", "Not dead", "Pan player", "All", "Monarchs"],
    },
    WordSquare {
        words: ["MANGO", "ARISE", "NICHE", "GENES", "ONSET"],
        across: ["Tropical fruit", "Wake up", "Special spot", "DNA units", "Beginning"],
        down: ["Fruit", "Get up", "Market segment", "Hereditary units", "Start"],
    },
    WordSquare {
        words: ["DENIM", "EVADE", "NAIVE", "IMAGE", "MELEE"],
        across: ["Jean fabric", "Avoid", "Innocent", "Picture", "Brawl"],
        down: ["Jeans material", "Dodge", "Gullible", "Photo", "Fight"],
    },
    WordSquare {
        words: ["OZONE", "ZEBRA", "OBESE", "NEARS", "EASES"],
        across: ["Atmosphere layer", "Striped animal", "Very overweight", "Approaches", "Reduces"],
        down: ["O3 layer", "Safari animal", "Heavy", "Gets close", "Lessens"],
    },
    WordSquare {
        words: ["THETA", "HOVER", "ERROR", "TERSE", "AREAS"],
        across: ["Greek letter", "Float", "Mistake", "Brief", "Regions"],
        down: ["Greek T", "Stay aloft", "Bug", "Concise", "Zones"],
    },
    WordSquare {
        words: ["DEALS", "ELITE", "AIDES", "LEMUR", "STERN"],
        across: ["Bargains", "Upper class", "Helpers", "Madagascar animal", "Rear of ship"],
        down: ["Sales", "Best of best", "Assistants", "Ring-tail", "Strict"],
    },
    WordSquare {
        words: ["ATTIC", "TIARA", "TIDAL", "IRATE", "CALES"],
        across: ["Storage room", "Royal crown", "Wave-related", "Angry", "Weights"],
        down: ["Upper floor", "Princess wear", "Ocean pattern", "Furious", "Scales"],
    },
    WordSquare {
        words: ["PANEL", "ARENA", "NEEDY", "ENDOW", "LAYER"],
        across: ["Discussion group", "Sports venue", "In want", "Grant funds", "Stratum"],
        down: ["Flat section", "Stadium", "Poor", "Provide", "Coating"],
    },
    WordSquare {
        words: ["LUNAR", "UNITE", "NITER", "ATONE", "REEDS"],
        across: ["Moon-related", "Join together", "Saltpeter", "Make amends", "Marsh plants"],
        down: ["Of the moon", "Combine", "Potassium nitrate", "Apologize", "Swamp grass"],
    },
    WordSquare {
        words: ["TIGER", "IRATE", "GASES", "ETEXT", "RESET"],
        across: ["Striped cat", "Angry", "Vapors", "Digital book", "Start over"],
        down: ["Big cat", "Furious", "Fumes", "Online text", "Restart"],
    },
];


/// Count of curated word squares available for seed selection.
#[must_use]
pub fn word_square_count() -> usize {
    WORD_SQUARES.len()
}

/// Generate puzzle_data + solution JSON for a seed (parity with TS generatePuzzle).
///
/// - `puzzle_data.grid`: 5×5 with `null` black / `""` letter cells
/// - `puzzle_data.clues`: across/down with numbers (matches TS generateClues)
/// - `solution.grid`: 5×5 letter strings (empty string = black; word-square pool has none)
#[must_use]
pub fn generate_crossword_puzzle(seed: i64) -> (Value, Value) {
    let idx = seed.unsigned_abs() as usize % WORD_SQUARES.len();
    let square = &WORD_SQUARES[idx];

    // Client grid: letter cells are empty strings (filled by player).
    let mut client_grid: Vec<Vec<Value>> = Vec::with_capacity(CROSSWORD_GRID_SIZE);
    let mut solution_grid: Vec<Vec<Value>> = Vec::with_capacity(CROSSWORD_GRID_SIZE);
    for word in &square.words {
        let chars: Vec<char> = word.chars().collect();
        debug_assert_eq!(chars.len(), CROSSWORD_GRID_SIZE);
        client_grid.push(vec![Value::String(String::new()); CROSSWORD_GRID_SIZE]);
        solution_grid.push(
            chars
                .into_iter()
                .map(|c| Value::String(c.to_string()))
                .collect(),
        );
    }

    let mut across = Vec::with_capacity(5);
    for (row, (word, clue)) in square.words.iter().zip(square.across.iter()).enumerate() {
        let number = if row == 0 { 1 } else { row + 5 };
        across.push(json!({
            "number": number,
            "clue": clue,
            "answer": word,
            "row": row,
            "col": 0,
            "length": word.len(),
        }));
    }

    let mut down = Vec::with_capacity(5);
    for (col, (word, clue)) in square.words.iter().zip(square.down.iter()).enumerate() {
        down.push(json!({
            "number": col + 1,
            "clue": clue,
            "answer": word,
            "row": 0,
            "col": col,
            "length": word.len(),
        }));
    }

    let puzzle_data = json!({
        "grid": client_grid,
        "clues": {
            "across": across,
            "down": down,
        },
    });
    let solution = json!({ "grid": solution_grid });
    (puzzle_data, solution)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_is_deterministic() {
        let (a, sa) = generate_crossword_puzzle(956);
        let (b, sb) = generate_crossword_puzzle(956);
        assert_eq!(a, b);
        assert_eq!(sa, sb);
    }

    #[test]
    fn solution_is_5x5_letters() {
        let (_pd, sol) = generate_crossword_puzzle(1);
        let grid = sol.get("grid").and_then(|g| g.as_array()).expect("grid");
        assert_eq!(grid.len(), 5);
        for row in grid {
            let cells = row.as_array().expect("row");
            assert_eq!(cells.len(), 5);
            for c in cells {
                let s = c.as_str().expect("letter");
                assert_eq!(s.len(), 1);
                assert!(s.chars().next().unwrap().is_ascii_uppercase());
            }
        }
    }

    #[test]
    fn pool_nonempty() {
        assert!(word_square_count() >= 30);
    }
}
