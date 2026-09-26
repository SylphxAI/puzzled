//! Daily generator for `word-search`: a port with byte parity of
//! `apps/puzzled/src/games/word-search/generator.ts`, checked against
//! `tests/fixtures/generate/word-search.json`.
//!
//! A seeded theme, its words shuffled, 6–10 of them placed in a 10×10 grid in
//! eight directions (50 start tries per direction), then random fill letters.

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::random::{shuffle_array, SeededRandom};

const GRID_SIZE: usize = 10;
const MIN_WORDS: usize = 6;
const MAX_WORDS: usize = 10;
const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// Themed word lists, in TS order (`THEMES` in generator.ts).
const THEMES: &[(&str, &[&str])] = &[
    (
        "Animals",
        &[
            "LION", "TIGER", "BEAR", "WOLF", "EAGLE", "SHARK", "WHALE", "SNAKE", "HORSE", "ZEBRA",
            "PANDA", "KOALA", "RABBIT", "MONKEY", "DOLPHIN", "PENGUIN", "GIRAFFE", "ELEPHANT",
            "LEOPARD", "CHEETAH",
        ],
    ),
    (
        "Fruits",
        &[
            "APPLE", "BANANA", "ORANGE", "GRAPE", "MANGO", "PEACH", "PEAR", "PLUM", "LEMON",
            "LIME", "MELON", "CHERRY", "BERRY", "PAPAYA", "GUAVA", "KIWI", "FIG", "DATE",
            "COCONUT", "APRICOT",
        ],
    ),
    (
        "Colors",
        &[
            "RED", "BLUE", "GREEN", "YELLOW", "ORANGE", "PURPLE", "PINK", "BLACK", "WHITE",
            "BROWN", "GRAY", "GOLD", "SILVER", "VIOLET", "INDIGO", "CYAN", "MAROON", "NAVY",
            "TEAL", "OLIVE",
        ],
    ),
    (
        "Sports",
        &[
            "SOCCER",
            "TENNIS",
            "GOLF",
            "HOCKEY",
            "RUGBY",
            "BOXING",
            "SKIING",
            "DIVING",
            "ROWING",
            "FENCING",
            "ARCHERY",
            "CYCLING",
            "RUNNING",
            "SWIMMING",
            "SURFING",
            "BOWLING",
            "BASEBALL",
            "BASKETBALL",
            "FOOTBALL",
            "VOLLEYBALL",
        ],
    ),
    (
        "Countries",
        &[
            "FRANCE", "SPAIN", "ITALY", "GERMANY", "BRAZIL", "JAPAN", "CHINA", "INDIA", "EGYPT",
            "GREECE", "MEXICO", "CANADA", "SWEDEN", "NORWAY", "POLAND", "TURKEY", "RUSSIA", "PERU",
            "CHILE", "KENYA",
        ],
    ),
    (
        "Weather",
        &[
            "SUNNY",
            "RAINY",
            "CLOUDY",
            "WINDY",
            "FOGGY",
            "STORM",
            "SNOW",
            "HAIL",
            "FROST",
            "SLEET",
            "THUNDER",
            "LIGHTNING",
            "RAINBOW",
            "BREEZE",
            "DRIZZLE",
            "BLIZZARD",
            "TORNADO",
            "HURRICANE",
            "MONSOON",
            "HEAT",
        ],
    ),
    (
        "Music",
        &[
            "PIANO",
            "GUITAR",
            "DRUMS",
            "VIOLIN",
            "FLUTE",
            "TRUMPET",
            "HARP",
            "CELLO",
            "BASS",
            "SAXOPHONE",
            "CLARINET",
            "HARMONICA",
            "BANJO",
            "MELODY",
            "RHYTHM",
            "CHORUS",
            "VERSE",
            "BEAT",
            "TEMPO",
            "HARMONY",
        ],
    ),
    (
        "Space",
        &[
            "STAR", "MOON", "PLANET", "COMET", "METEOR", "GALAXY", "NEBULA", "ORBIT", "ROCKET",
            "SATURN", "JUPITER", "MARS", "VENUS", "NEPTUNE", "URANUS", "PLUTO", "ASTEROID",
            "COSMOS", "SOLAR", "LUNAR",
        ],
    ),
    (
        "Food",
        &[
            "BREAD", "CHEESE", "PIZZA", "PASTA", "RICE", "SOUP", "SALAD", "STEAK", "CHICKEN",
            "FISH", "BURGER", "TACO", "SUSHI", "CURRY", "NOODLE", "WAFFLE", "PANCAKE", "SANDWICH",
            "PRETZEL", "COOKIE",
        ],
    ),
    (
        "Nature",
        &[
            "TREE",
            "FLOWER",
            "RIVER",
            "OCEAN",
            "MOUNTAIN",
            "VALLEY",
            "FOREST",
            "DESERT",
            "ISLAND",
            "BEACH",
            "LAKE",
            "WATERFALL",
            "CANYON",
            "VOLCANO",
            "GLACIER",
            "MEADOW",
            "JUNGLE",
            "PRAIRIE",
            "CLIFF",
            "CAVE",
        ],
    ),
    (
        "Technology",
        &[
            "COMPUTER",
            "PHONE",
            "TABLET",
            "LAPTOP",
            "MOUSE",
            "KEYBOARD",
            "MONITOR",
            "PRINTER",
            "ROUTER",
            "MODEM",
            "WIFI",
            "BLUETOOTH",
            "SOFTWARE",
            "HARDWARE",
            "INTERNET",
            "EMAIL",
            "BROWSER",
            "DATABASE",
            "SERVER",
            "CLOUD",
        ],
    ),
    (
        "Occupations",
        &[
            "DOCTOR",
            "NURSE",
            "TEACHER",
            "LAWYER",
            "CHEF",
            "PILOT",
            "ARTIST",
            "WRITER",
            "FARMER",
            "BAKER",
            "ENGINEER",
            "SCIENTIST",
            "MUSICIAN",
            "ACTOR",
            "ATHLETE",
            "DESIGNER",
            "ARCHITECT",
            "MECHANIC",
            "PLUMBER",
            "DENTIST",
        ],
    ),
];

/// Directions in TS order, with their `(row, col)` step.
const DIRECTIONS: [(&str, i64, i64); 8] = [
    ("horizontal", 0, 1),
    ("vertical", 1, 0),
    ("diagonal-down", 1, 1),
    ("diagonal-up", -1, 1),
    ("horizontal-reverse", 0, -1),
    ("vertical-reverse", -1, 0),
    ("diagonal-down-reverse", -1, -1),
    ("diagonal-up-reverse", 1, -1),
];

struct Placement {
    word: String,
    start: (i64, i64),
    end: (i64, i64),
    direction: &'static str,
}

fn try_place_word(
    grid: &mut [Vec<u8>],
    word: &[u8],
    random: &mut SeededRandom,
) -> Option<Placement> {
    let len = word.len() as i64;
    let size = GRID_SIZE as i64;
    for (direction, vr, vc) in shuffle_array(&DIRECTIONS, random) {
        // TS: GRID_SIZE - 1 - max(0, (len - 1) * |v|), and min = len - 1 when v < 0.
        let max_row = size - 1 - ((len - 1) * vr.abs()).max(0);
        let max_col = size - 1 - ((len - 1) * vc.abs()).max(0);
        let min_row = if vr < 0 { len - 1 } else { 0 };
        let min_col = if vc < 0 { len - 1 } else { 0 };
        if max_row < min_row || max_col < min_col {
            continue;
        }
        for _ in 0..50 {
            let start_row =
                min_row + (random.next_f64() * (max_row - min_row + 1) as f64).floor() as i64;
            let start_col =
                min_col + (random.next_f64() * (max_col - min_col + 1) as f64).floor() as i64;
            let fits = word.iter().enumerate().all(|(i, letter)| {
                let row = (start_row + i as i64 * vr) as usize;
                let col = (start_col + i as i64 * vc) as usize;
                let current = grid[row][col];
                current == 0 || current == *letter
            });
            if fits {
                for (i, letter) in word.iter().enumerate() {
                    let row = (start_row + i as i64 * vr) as usize;
                    let col = (start_col + i as i64 * vc) as usize;
                    grid[row][col] = *letter;
                }
                return Some(Placement {
                    word: String::from_utf8_lossy(word).into_owned(),
                    start: (start_row, start_col),
                    end: (start_row + (len - 1) * vr, start_col + (len - 1) * vc),
                    direction,
                });
            }
        }
    }
    None
}

/// `(puzzle_data, solution)` for a seed. Difficulty is not used by this game.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let mut random = SeededRandom::new(seed);
    let theme_index = (random.next_f64() * THEMES.len() as f64).floor() as usize;
    let (theme_name, theme_words) = THEMES
        .get(theme_index)
        .copied()
        .ok_or_else(|| "word-search: theme index out of range".to_string())?;
    let shuffled = shuffle_array(theme_words, &mut random);
    let target =
        MIN_WORDS + (random.next_f64() * (MAX_WORDS - MIN_WORDS + 1) as f64).floor() as usize;
    let eligible: Vec<&str> = shuffled
        .into_iter()
        .filter(|word| word.len() <= GRID_SIZE)
        .collect();

    let mut grid = vec![vec![0u8; GRID_SIZE]; GRID_SIZE];
    let mut placements: Vec<Placement> = Vec::new();
    for word in eligible {
        if placements.len() >= target {
            break;
        }
        if let Some(placement) = try_place_word(&mut grid, word.as_bytes(), &mut random) {
            placements.push(placement);
        }
    }
    for row in &mut grid {
        for cell in row.iter_mut() {
            if *cell == 0 {
                *cell = ALPHABET[(random.next_f64() * ALPHABET.len() as f64).floor() as usize];
            }
        }
    }

    let grid_json: Vec<Vec<String>> = grid
        .iter()
        .map(|row| row.iter().map(|c| (*c as char).to_string()).collect())
        .collect();
    let words: Vec<&str> = placements.iter().map(|p| p.word.as_str()).collect();
    let placements_json: Vec<Value> = placements
        .iter()
        .map(|p| {
            json!({
                "word": p.word,
                "start": { "row": p.start.0, "col": p.start.1 },
                "end": { "row": p.end.0, "col": p.end.1 },
                "direction": p.direction,
            })
        })
        .collect();
    Ok((
        json!({ "grid": grid_json, "theme": theme_name, "wordCount": words.len() }),
        json!({ "words": words, "placements": placements_json }),
    ))
}

/// The validator grades `{ foundWords }`: every solution word found.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "foundWords": solution.get("words").cloned().unwrap_or_else(|| json!([])) })
}
