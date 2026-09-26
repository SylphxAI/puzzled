//! Daily generator for `arithmo`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/arithmo/generator.ts`), checked against
//! `tests/fixtures/generate/arithmo.json`.
//!
//! The pool of every valid 8-character equation is built in the TS order,
//! shuffled once with the frozen LCG (seed 42), and the day's equation is
//! `pool[|seed| % len]`.

use serde_json::{json, Value};

use crate::puzzle_play::random::{seeded_random, shuffle_array};

fn push_if_eight(pool: &mut Vec<String>, eq: String) {
    if eq.len() == 8 {
        pool.push(eq);
    }
}

fn equation_pool() -> Vec<String> {
    let mut eqs: Vec<String> = Vec::new();
    // NN+NN=NN
    for a in 10..=99 {
        for b in 10..=99 {
            let c = a + b;
            if (10..=99).contains(&c) {
                push_if_eight(&mut eqs, format!("{a}+{b}={c}"));
            }
        }
    }
    // NN-NN=NN
    for a in 10..=99 {
        for b in 10..=99 {
            let c = a - b;
            if (10..=99).contains(&c) {
                push_if_eight(&mut eqs, format!("{a}-{b}={c}"));
            }
        }
    }
    // NNN/N=NN
    for a in 100..=999 {
        for b in 2..=9 {
            if a % b == 0 {
                let c = a / b;
                if (10..=99).contains(&c) {
                    push_if_eight(&mut eqs, format!("{a}/{b}={c}"));
                }
            }
        }
    }
    // N*NN=NNN
    for a in 2..=9 {
        for b in 10..=99 {
            let c = a * b;
            if (100..=999).contains(&c) {
                push_if_eight(&mut eqs, format!("{a}*{b}={c}"));
            }
        }
    }
    // N+N*N=NN
    for a in 1..=9 {
        for b in 2..=9 {
            for c in 2..=9 {
                let d = a + b * c;
                if (10..=99).contains(&d) {
                    push_if_eight(&mut eqs, format!("{a}+{b}*{c}={d}"));
                }
            }
        }
    }
    // N*N+N=NN
    for a in 2..=9 {
        for b in 2..=9 {
            for c in 1..=9 {
                let d = a * b + c;
                if (10..=99).contains(&d) {
                    push_if_eight(&mut eqs, format!("{a}*{b}+{c}={d}"));
                }
            }
        }
    }
    // N*N-N=NN
    for a in 2..=9 {
        for b in 2..=9 {
            for c in 1..=9 {
                let d = a * b - c;
                if (10..=99).contains(&d) {
                    push_if_eight(&mut eqs, format!("{a}*{b}-{c}={d}"));
                }
            }
        }
    }
    shuffle_array(&eqs, &mut seeded_random(42))
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let pool = equation_pool();
    if pool.is_empty() {
        return Err("arithmo: empty equation pool".to_string());
    }
    let len = i64::try_from(pool.len()).map_err(|e| e.to_string())?;
    let index = usize::try_from(seed.abs() % len).map_err(|e| e.to_string())?;
    let equation = pool
        .get(index)
        .ok_or_else(|| "arithmo: index out of range".to_string())?;
    Ok((json!({ "length": 8 }), json!({ "equation": equation })))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    let equation = solution
        .get("equation")
        .and_then(Value::as_str)
        .unwrap_or_default();
    json!({ "guesses": [equation] })
}
