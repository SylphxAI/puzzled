//! arithmo (equation Wordle): per-character feedback for one guessed
//! equation against the stored answer, the same two-pass rule as the TS
//! `getGuessResult` (`apps/puzzled/src/games/arithmo/types.ts`).

use serde_json::{json, Value};

const EQUATION_LENGTH: usize = 8;

/// `{"equation":"12+34=46"}` → `{"tiles":[8 × correct|present|absent]}`.
pub fn grade(solution: &Value, guess: &Value) -> Result<Value, String> {
    let answer: Vec<char> = solution
        .get("equation")
        .and_then(Value::as_str)
        .ok_or("missing solution equation")?
        .chars()
        .collect();
    let guessed: Vec<char> = guess
        .get("equation")
        .and_then(Value::as_str)
        .ok_or("missing guess equation")?
        .trim()
        .chars()
        .collect();
    if guessed.len() != EQUATION_LENGTH || answer.len() != EQUATION_LENGTH {
        return Err("an equation is eight characters".into());
    }
    let mut tiles = ["absent"; EQUATION_LENGTH];
    let mut used = [false; EQUATION_LENGTH];
    for i in 0..EQUATION_LENGTH {
        if guessed[i] == answer[i] {
            tiles[i] = "correct";
            used[i] = true;
        }
    }
    for i in 0..EQUATION_LENGTH {
        if tiles[i] == "correct" {
            continue;
        }
        if let Some(j) = (0..EQUATION_LENGTH).find(|&j| !used[j] && guessed[i] == answer[j]) {
            tiles[i] = "present";
            used[j] = true;
        }
    }
    Ok(json!({ "tiles": tiles }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn marks_correct_then_present_like_the_ts_rule() {
        let solution = json!({"equation": "119/7=17"});
        let graded = grade(&solution, &json!({"equation": "119/7=17"})).unwrap();
        assert_eq!(
            graded["tiles"],
            json!([
                "correct", "correct", "correct", "correct", "correct", "correct", "correct",
                "correct"
            ])
        );
        let graded = grade(&solution, &json!({"equation": "17=119/7"})).unwrap();
        assert!(graded["tiles"]
            .as_array()
            .unwrap()
            .iter()
            .all(|t| t != "absent"));
        assert!(grade(&solution, &json!({"equation": "1+1=2"})).is_err());
    }
}
