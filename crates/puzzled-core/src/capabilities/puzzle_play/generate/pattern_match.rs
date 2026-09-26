//! Daily generator for `pattern-match`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/pattern-match/types.ts`
//! `selectCardsWithSets` via `puzzles.ts` and `config.ts`), checked against
//! `tests/fixtures/generate/pattern-match.json`.
//!
//! TS uses Mulberry32 here (not the shared LCG) over a JS double state; the
//! port reproduces its `ToInt32` / `Math.imul` / `>>>` semantics.

use serde_json::{json, Value};

const MIN_SETS: usize = 6;
/// TS throws after 200 attempts; keep drawing random selections past it.
const MAX_ATTEMPTS: i64 = 20_000;

struct Mulberry32 {
    state: i64,
}

impl Mulberry32 {
    fn next_f64(&mut self) -> f64 {
        self.state += 0x6d2b_79f5;
        let t = self.state as u32;
        let t1 = ((t ^ (t >> 15)) as i32).wrapping_mul((t | 1) as i32);
        let tu = t1 as u32;
        let m = ((tu ^ (tu >> 7)) as i32).wrapping_mul(t1 | 61);
        let sum = (i64::from(t1) + i64::from(m)) as u32 as i32;
        let t2 = (t1 ^ sum) as u32;
        f64::from(t2 ^ (t2 >> 14)) / 4_294_967_296.0
    }
}

#[derive(Clone, Copy)]
struct Card {
    shape: usize,
    color: usize,
    fill: usize,
    count: usize,
}

const SHAPES: [&str; 3] = ["diamond", "oval", "squiggle"];
const COLORS: [&str; 3] = ["red", "green", "purple"];
const FILLS: [&str; 3] = ["solid", "striped", "empty"];

fn all_cards() -> Vec<Card> {
    let mut cards = Vec::with_capacity(81);
    for shape in 0..3 {
        for color in 0..3 {
            for fill in 0..3 {
                for count in 0..3 {
                    cards.push(Card {
                        shape,
                        color,
                        fill,
                        count,
                    });
                }
            }
        }
    }
    cards
}

fn prop_ok(a: usize, b: usize, c: usize) -> bool {
    (a == b && b == c) || (a != b && b != c && a != c)
}

fn find_all_sets(cards: &[Card]) -> Vec<[usize; 3]> {
    let mut sets = Vec::new();
    let n = cards.len();
    for i in 0..n.saturating_sub(2) {
        for j in i + 1..n - 1 {
            for k in j + 1..n {
                let (a, b, c) = (cards[i], cards[j], cards[k]);
                if prop_ok(a.shape, b.shape, c.shape)
                    && prop_ok(a.color, b.color, c.color)
                    && prop_ok(a.fill, b.fill, c.fill)
                    && prop_ok(a.count, b.count, c.count)
                {
                    sets.push([i, j, k]);
                }
            }
        }
    }
    sets
}

fn select_cards(seed: i64) -> Result<Vec<Card>, String> {
    let mut shuffled = all_cards();
    let mut random = Mulberry32 { state: seed };
    for i in (1..shuffled.len()).rev() {
        let j = (random.next_f64() * (i as f64 + 1.0)).floor() as usize;
        shuffled.swap(i, j);
    }
    for attempt in 0..MAX_ATTEMPTS {
        let selected: Vec<Card> = if attempt < 50 {
            let start = ((attempt * 7) as usize) % (shuffled.len() - 12);
            shuffled[start..start + 12].to_vec()
        } else {
            let mut r = Mulberry32 {
                state: seed + attempt * 1337,
            };
            let mut picked = Vec::with_capacity(12);
            let mut indices = Vec::with_capacity(12);
            while indices.len() < 12 {
                let idx = (r.next_f64() * shuffled.len() as f64).floor() as usize;
                if !indices.contains(&idx) {
                    indices.push(idx);
                    picked.push(shuffled[idx]);
                }
            }
            picked
        };
        if find_all_sets(&selected).len() >= MIN_SETS {
            return Ok(selected);
        }
    }
    Err(format!(
        "pattern-match: no 12 cards with {MIN_SETS}+ sets for seed {seed}"
    ))
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let cards = select_cards(seed)?;
    let sets = find_all_sets(&cards);
    let cards_json: Vec<Value> = cards
        .iter()
        .enumerate()
        .map(|(id, c)| {
            json!({
                "id": id,
                "shape": SHAPES[c.shape],
                "color": COLORS[c.color],
                "fill": FILLS[c.fill],
                "count": c.count + 1,
            })
        })
        .collect();
    let sets_json: Vec<Value> = sets.iter().map(|s| json!(s)).collect();
    Ok((
        json!({ "cards": cards_json, "totalSets": sets.len() }),
        json!({ "validSets": sets_json, "totalSets": sets.len() }),
    ))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({
        "foundSets": solution.get("validSets").cloned().unwrap_or(Value::Null),
        "mistakes": 0,
    })
}
