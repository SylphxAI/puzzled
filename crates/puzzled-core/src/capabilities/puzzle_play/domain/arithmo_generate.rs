//! Deterministic Arithmo generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/arithmo/generator.ts`.

use std::sync::OnceLock;

use serde_json::{json, Value};

use super::arithmo::EQUATION_LENGTH;
use super::random::{seeded_random, shuffle_array};

const POOL_SHUFFLE_SEED: i64 = 42;

fn raw_equation_pool() -> Vec<String> {
    let mut equations = Vec::new();

    for a in 10..=99 {
        for b in 10..=99 {
            let c = a + b;
            if (10..=99).contains(&c) {
                let equation = format!("{a}+{b}={c}");
                if equation.len() == EQUATION_LENGTH {
                    equations.push(equation);
                }
            }
        }
    }

    for a in 10..=99 {
        for b in 10..=99 {
            let c = a - b;
            if (10..=99).contains(&c) {
                let equation = format!("{a}-{b}={c}");
                if equation.len() == EQUATION_LENGTH {
                    equations.push(equation);
                }
            }
        }
    }

    for a in 100..=999 {
        for b in 2..=9 {
            if a % b == 0 {
                let c = a / b;
                if (10..=99).contains(&c) {
                    let equation = format!("{a}/{b}={c}");
                    if equation.len() == EQUATION_LENGTH {
                        equations.push(equation);
                    }
                }
            }
        }
    }

    for a in 2..=9 {
        for b in 10..=99 {
            let c = a * b;
            if (100..=999).contains(&c) {
                let equation = format!("{a}*{b}={c}");
                if equation.len() == EQUATION_LENGTH {
                    equations.push(equation);
                }
            }
        }
    }

    for a in 1..=9 {
        for b in 2..=9 {
            for c in 2..=9 {
                let d = a + b * c;
                if (10..=99).contains(&d) {
                    let equation = format!("{a}+{b}*{c}={d}");
                    if equation.len() == EQUATION_LENGTH {
                        equations.push(equation);
                    }
                }
            }
        }
    }

    for a in 2..=9 {
        for b in 2..=9 {
            for c in 1..=9 {
                let d = a * b + c;
                if (10..=99).contains(&d) {
                    let equation = format!("{a}*{b}+{c}={d}");
                    if equation.len() == EQUATION_LENGTH {
                        equations.push(equation);
                    }
                }
            }
        }
    }

    for a in 2..=9 {
        for b in 2..=9 {
            for c in 1..=9 {
                let d = a * b - c;
                if (10..=99).contains(&d) {
                    let equation = format!("{a}*{b}-{c}={d}");
                    if equation.len() == EQUATION_LENGTH {
                        equations.push(equation);
                    }
                }
            }
        }
    }

    equations
}

fn equation_pool() -> &'static [String] {
    static POOL: OnceLock<Vec<String>> = OnceLock::new();
    POOL.get_or_init(|| {
        let raw = raw_equation_pool();
        let mut random = seeded_random(POOL_SHUFFLE_SEED);
        shuffle_array(&raw, &mut random)
    })
}

/// Generate client puzzle data + server equation for a seed.
#[must_use]
pub fn generate_arithmo_puzzle(seed: i64) -> (Value, Value) {
    let pool = equation_pool();
    let index = (seed.unsigned_abs() as usize) % pool.len();
    (
        json!({ "length": EQUATION_LENGTH }),
        json!({ "equation": pool[index] }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(generate_arithmo_puzzle(5), generate_arithmo_puzzle(5));
    }

    #[test]
    fn pool_size_matches_ts() {
        assert_eq!(equation_pool().len(), 9279);
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let cases = [
            (0, "15+15=30"),
            (1, "48-15=33"),
            (5, "41+42=83"),
            (42, "279/3=93"),
            (100, "11+47=58"),
            (1000, "216/3=72"),
            (20_240_101, "79-66=13"),
            (-12_345, "16+23=39"),
        ];
        for (seed, equation) in cases {
            let (data, solution) = generate_arithmo_puzzle(seed);
            assert_eq!(data["length"], EQUATION_LENGTH);
            assert!(data.get("equation").is_none());
            assert_eq!(solution["equation"], equation, "seed {seed}");
        }
    }
}
