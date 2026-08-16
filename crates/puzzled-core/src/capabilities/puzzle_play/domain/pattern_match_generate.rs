//! Deterministic pattern-match generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/pattern-match/types.ts#selectCardsWithSets`.

use serde_json::{json, Value};

use super::pattern_match::{find_all_sets, generate_all_cards, Card};

fn to_uint32(value: f64) -> u32 {
    if !value.is_finite() {
        return 0;
    }
    let truncated = value.trunc();
    let mut modulo = truncated % 4_294_967_296.0;
    if modulo < 0.0 {
        modulo += 4_294_967_296.0;
    }
    modulo as u32
}

fn to_int32(value: f64) -> i32 {
    to_uint32(value) as i32
}

/// JS `Math.imul` + Mulberry32 used by the frozen TS selector.
struct Mulberry32 {
    state: f64,
}

impl Mulberry32 {
    fn new(seed: f64) -> Self {
        Self { state: seed }
    }

    fn next_f64(&mut self) -> f64 {
        self.state += 1_831_565_813.0;
        let mut t = self.state;
        let first = (to_int32(t) ^ (to_uint32(t) >> 15) as i32).wrapping_mul(to_int32(t) | 1);
        t = f64::from(first);
        let second = (to_int32(t) ^ (to_uint32(t) >> 7) as i32).wrapping_mul(to_int32(t) | 61);
        t = f64::from(to_int32(t) ^ to_int32(t + f64::from(second)));
        f64::from((to_int32(t) ^ (to_uint32(t) >> 14) as i32) as u32) / 4_294_967_296.0
    }
}

fn select_cards_with_sets(seed: i64, min_sets: usize) -> Vec<Card> {
    let all_cards = generate_all_cards();
    let mut random = Mulberry32::new(seed as f64);
    let mut shuffled = all_cards;
    for index in (1..shuffled.len()).rev() {
        let swap_index = (random.next_f64() * (index as f64 + 1.0)).floor() as usize;
        shuffled.swap(index, swap_index);
    }

    for attempt in 0..200 {
        let selected = if attempt < 50 {
            let start_index = (attempt * 7) % (shuffled.len() - 12);
            shuffled[start_index..start_index + 12].to_vec()
        } else {
            let mut attempt_random = Mulberry32::new(seed as f64 + (attempt * 1337) as f64);
            let mut selected = Vec::with_capacity(12);
            let mut indices = std::collections::BTreeSet::new();
            while indices.len() < 12 {
                let idx = (attempt_random.next_f64() * shuffled.len() as f64).floor() as usize;
                if indices.insert(idx) {
                    selected.push(shuffled[idx]);
                }
            }
            selected
        };
        let cards: Vec<Card> = selected
            .into_iter()
            .enumerate()
            .map(|(idx, mut card)| {
                card.id = u32::try_from(idx).unwrap_or(0);
                card
            })
            .collect();
        if find_all_sets(&cards).len() >= min_sets {
            return cards;
        }
    }
    panic!("PatternMatch: Failed to find {min_sets}+ sets in 12 cards for seed {seed}");
}

fn card_json(card: &Card) -> Value {
    json!({
        "id": card.id,
        "shape": card.shape.as_str(),
        "color": card.color.as_str(),
        "fill": card.fill.as_str(),
        "count": card.count,
    })
}

/// Generate client cards + server valid sets for a seed.
#[must_use]
pub fn generate_pattern_match_puzzle(seed: i64) -> (Value, Value) {
    let cards = select_cards_with_sets(seed, 6);
    let sets = find_all_sets(&cards);
    let client_cards: Vec<Value> = cards.iter().map(card_json).collect();
    (
        json!({
            "cards": client_cards,
            "totalSets": sets.len(),
        }),
        json!({
            "validSets": sets,
            "totalSets": sets.len(),
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mulberry32_matches_ts_draws() {
        let cases: &[(f64, [f64; 8])] = &[
            (
                5.0,
                [
                    0.689_774_910_919_368_3,
                    0.772_743_273_293_599_5,
                    0.219_763_010_274_618_86,
                    0.623_178_822_221_234_4,
                    0.085_137_201_240_286_23,
                    0.592_164_940_200_746_1,
                    0.720_102_245_686_575_8,
                    0.458_104_212_535_545_23,
                ],
            ),
            (
                42.0,
                [
                    0.601_103_751_920_163_6,
                    0.448_290_558_997_541_67,
                    0.852_465_793_490_409_9,
                    0.669_734_041_439_369_3,
                    0.174_813_898_745_924_23,
                    0.526_592_542_184_516_8,
                    0.273_227_994_330_227_4,
                    0.624_744_653_934_612_9,
                ],
            ),
        ];
        for (seed, expected) in cases {
            let mut rng = Mulberry32::new(*seed);
            for value in expected {
                let actual = rng.next_f64();
                assert!(
                    (actual - value).abs() < 1e-15,
                    "seed {seed} draw {actual} != {value}"
                );
            }
        }
    }

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(
            generate_pattern_match_puzzle(5),
            generate_pattern_match_puzzle(5)
        );
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let (data, solution) = generate_pattern_match_puzzle(5);
        assert_eq!(data["totalSets"], 6);
        assert_eq!(data["cards"][0]["shape"], "squiggle");
        assert_eq!(data["cards"][0]["color"], "green");
        assert_eq!(data["cards"][0]["fill"], "striped");
        assert_eq!(data["cards"][0]["count"], 3);
        assert_eq!(data["cards"][1]["shape"], "squiggle");
        assert!(data.get("validSets").is_none());
        assert_eq!(solution["validSets"][0], json!([0, 4, 5]));

        let (data42, _) = generate_pattern_match_puzzle(42);
        assert_eq!(data42["cards"][0]["shape"], "squiggle");
        assert_eq!(data42["cards"][0]["color"], "red");
        assert_eq!(data42["cards"][0]["fill"], "solid");
        assert_eq!(data42["cards"][0]["count"], 2);

        let (data_big, _) = generate_pattern_match_puzzle(12_345);
        assert_eq!(data_big["cards"][0]["shape"], "diamond");
        assert_eq!(data_big["cards"][0]["color"], "purple");
        assert_eq!(data_big["cards"][0]["fill"], "empty");
        assert_eq!(data_big["cards"][0]["count"], 2);
    }
}
