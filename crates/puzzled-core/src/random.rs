//! Frozen LCG + Fisher-Yates shuffle — parity with `apps/puzzled/src/games/shared/random.ts`.

const MULTIPLIER: f64 = 1_103_515_245.0;
const INCREMENT: f64 = 12_345.0;
const MODULUS: f64 = 2_147_483_647.0;

/// Match JavaScript `ToInt32` for IEEE-754 operands used by the frozen TS LCG.
fn to_int32(value: f64) -> i32 {
    let truncated = value.trunc();
    let mut bits = truncated as i64;
    bits &= 0xffff_ffff;
    bits as i32
}

/// Seeded PRNG matching the frozen TypeScript `seededRandom` implementation.
#[derive(Debug, Clone)]
pub struct SeededRandom {
    state: f64,
    /// Total draws (for differential debugging / parity tests).
    pub draw_count: u64,
}

impl SeededRandom {
    #[must_use]
    pub fn new(seed: i64) -> Self {
        Self {
            state: seed as f64,
            draw_count: 0,
        }
    }

    /// Current internal state after last draw (mirrors TS masked state).
    #[must_use]
    pub fn state_bits(&self) -> u32 {
        self.state as u32
    }

    /// Draw the next value in `[0, 1)`.
    /// Named `next_f64` (not `next`) to avoid clippy `should_implement_trait` vs `Iterator::next`.
    pub fn next_f64(&mut self) -> f64 {
        self.draw_count += 1;
        let product = self.state * MULTIPLIER + INCREMENT;
        let masked = (to_int32(product) as u32) & 0x7fff_ffff;
        self.state = f64::from(masked);
        self.state / MODULUS
    }

    /// Collect the next `count` draws (for golden fixture verification).
    #[must_use]
    pub fn next_n(&mut self, count: usize) -> Vec<f64> {
        (0..count).map(|_| self.next_f64()).collect()
    }
}

/// Convenience: create an RNG from a seed.
#[must_use]
pub fn seeded_random(seed: i64) -> SeededRandom {
    SeededRandom::new(seed)
}

/// Fisher-Yates shuffle matching frozen TypeScript `shuffleArray`.
///
/// TS:
/// ```text
/// for (let i = result.length - 1; i > 0; i--) {
///   const j = Math.floor(random() * (i + 1))
///   swap(result[i], result[j])
/// }
/// ```
/// `j` must be in `[0, i]` inclusive — multiplier is `(i + 1)`, not `i`.
#[must_use]
pub fn shuffle_array<T: Clone>(array: &[T], random: &mut SeededRandom) -> Vec<T> {
    let mut result = array.to_vec();
    for index in (1..result.len()).rev() {
        let random_unit = random.next_f64();
        // Match TS: Math.floor(random() * (i + 1)) → j ∈ [0, i]
        let swap_index = (random_unit * (index as f64 + 1.0)).floor() as usize;
        result.swap(index, swap_index);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_zero_first_draw_matches_frozen_baseline() {
        let mut rng = SeededRandom::new(0);
        let first = rng.next_f64();
        let expected = 12_345.0 / MODULUS;
        assert!(
            (first - expected).abs() < f64::EPSILON,
            "first draw {first} != expected {expected}"
        );
    }

    #[test]
    fn same_seed_produces_same_sequence() {
        let mut rng1 = SeededRandom::new(999);
        let mut rng2 = SeededRandom::new(999);
        for _ in 0..10 {
            assert_eq!(rng1.next_f64().to_bits(), rng2.next_f64().to_bits());
        }
    }

    /// Regression: Fisher-Yates must use `(i + 1)` (TS oracle). Using `i` alone
    /// never selects index `i` and drifts all sudoku seeds.
    #[test]
    fn shuffle_matches_ts_oracle_seed_corpus() {
        // Captured from apps/puzzled/src/games/shared/random.ts via bun.
        let cases: &[(i64, &[&str])] = &[
            (0, &["c", "d", "b", "a"]),
            (1, &["b", "d", "a", "c"]),
            (42, &["a", "d", "b", "c"]),
            (12_345, &["d", "b", "a", "c"]),
            (99_999, &["b", "a", "c", "d"]),
        ];
        for (seed, expected) in cases {
            let mut rng = SeededRandom::new(*seed);
            let actual = shuffle_array(&["a", "b", "c", "d"], &mut rng);
            assert_eq!(
                actual,
                expected.iter().copied().collect::<Vec<_>>(),
                "shuffle seed {seed}"
            );
        }
    }
}