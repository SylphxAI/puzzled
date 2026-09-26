//! Grade one quad-words guess against the four hidden words, so the client
//! never holds them (`PuzzleService.CheckGuess`).
//!
//! Guess: `{"word":"CRANE"}`. Result: `{"boards":[[5 statuses] x4]}`, each
//! status `correct` | `present` | `absent`, board order as stored. The final
//! finish is still validated as a whole by `submission_validation`.

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::wordle_eval::{evaluate_guess, LetterStatus};

fn status(s: &LetterStatus) -> &'static str {
    match s {
        LetterStatus::Correct => "correct",
        LetterStatus::Present => "present",
        LetterStatus::Absent => "absent",
    }
}

/// Grade `guess` against the stored `{"words":[4]}` solution.
pub fn grade(solution: &Value, guess: &Value) -> Result<Value, String> {
    let targets: Vec<&str> = solution
        .get("words")
        .and_then(Value::as_array)
        .ok_or("missing quad-words solution words")?
        .iter()
        .filter_map(Value::as_str)
        .collect();
    if targets.len() != 4 {
        return Err("quad-words solution needs four words".into());
    }
    let word = guess
        .get("word")
        .and_then(Value::as_str)
        .ok_or("missing guess word")?
        .trim();
    let boards = targets
        .iter()
        .map(|target| {
            evaluate_guess(word, target)
                .map(|tiles| tiles.iter().map(status).collect::<Vec<_>>())
                .ok_or_else(|| "guess must be a five-letter word".to_string())
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(json!({ "boards": boards }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solution() -> Value {
        json!({"words": ["NAVAL", "ROCKY", "PUNCH", "LAUGH"]})
    }

    #[test]
    fn grades_each_board_without_returning_the_words() {
        let graded = grade(&solution(), &json!({"word": "punch"})).unwrap();
        assert_eq!(
            graded["boards"][2],
            json!(["correct", "correct", "correct", "correct", "correct"])
        );
        assert_eq!(graded["boards"].as_array().map(Vec::len), Some(4));
        let text = graded.to_string();
        for hidden in ["NAVAL", "ROCKY", "LAUGH"] {
            assert!(!text.contains(hidden));
        }
        // LAUGH vs NAVAL: L present, A correct, U/G/H absent.
        let graded = grade(&solution(), &json!({"word": "LAUGH"})).unwrap();
        assert_eq!(
            graded["boards"][0],
            json!(["present", "correct", "absent", "absent", "absent"])
        );
    }

    #[test]
    fn refuses_bad_guesses_and_solutions() {
        assert!(grade(&solution(), &json!({"word": "ABC"})).is_err());
        assert!(grade(&solution(), &json!({})).is_err());
        assert!(grade(&json!({"words": ["NAVAL"]}), &json!({"word": "NAVAL"})).is_err());
    }
}
