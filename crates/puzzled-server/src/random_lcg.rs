//! Frozen LCG + Fisher-Yates — mirrors `apps/puzzled/src/games/shared/random.ts`.
//! ⚠️ FROZEN ALGORITHMS — do not change parameters (historical puzzle seeds).

/// Seeded RNG (glibc LCG). Returns values in [0, 1).
#[derive(Debug, Clone)]
pub struct SeededRandom {
    state: u32,
}

impl SeededRandom {
    #[must_use]
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    /// Next pseudo-random in [0, 1).
    pub fn next_f64(&mut self) -> f64 {
        // TS: state = (state * 1103515245 + 12345) & 0x7fffffff
        //     return state / 0x7fffffff
        self.state = self.state.wrapping_mul(1_103_515_245).wrapping_add(12_345) & 0x7fff_ffff;
        f64::from(self.state) / f64::from(0x7fff_ffff_u32)
    }
}

/// Fisher-Yates shuffle with provided RNG (does not mutate input).
#[must_use]
pub fn shuffle_array<T: Clone>(array: &[T], rng: &mut SeededRandom) -> Vec<T> {
    let mut result = array.to_vec();
    if result.len() <= 1 {
        return result;
    }
    for i in (1..result.len()).rev() {
        let j = (rng.next_f64() * (i as f64 + 1.0)).floor() as usize;
        result.swap(i, j.min(i));
    }
    result
}

/// Pick one element using RNG. Panics if empty (mirrors TS undefined on empty).
#[must_use]
pub fn pick_random<T: Clone>(array: &[T], rng: &mut SeededRandom) -> Option<T> {
    if array.is_empty() {
        return None;
    }
    let idx = (rng.next_f64() * array.len() as f64).floor() as usize;
    array.get(idx.min(array.len() - 1)).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lcg_deterministic() {
        let mut a = SeededRandom::new(42);
        let mut b = SeededRandom::new(42);
        for _ in 0..20 {
            let x = a.next_f64();
            let y = b.next_f64();
            assert!((x - y).abs() < f64::EPSILON);
            assert!((0.0..1.0).contains(&x));
        }
    }

    #[test]
    fn shuffle_preserves_multiset() {
        let mut rng = SeededRandom::new(7);
        let input = vec![1, 2, 3, 4, 5, 6, 7, 8, 9];
        let out = shuffle_array(&input, &mut rng);
        let mut a = input.clone();
        let mut b = out.clone();
        a.sort_unstable();
        b.sort_unstable();
        assert_eq!(a, b);
        // not always identity (very unlikely for seed 7)
        assert_eq!(out.len(), 9);
    }

    #[test]
    fn pick_random_in_range() {
        let mut rng = SeededRandom::new(1);
        let items = [10, 20, 30];
        for _ in 0..10 {
            let v = pick_random(&items, &mut rng).unwrap_or_else(|| panic!("pick"));
            assert!(items.contains(&v));
        }
        assert!(pick_random::<i32>(&[], &mut rng).is_none());
    }
}
