//! Grade one in-game guess on the server, so the client never holds the
//! answer (`PuzzleService.CheckGuess`). The finish is still validated as a
//! whole by `submission_validation`; this only answers "how did this guess do".

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::wordle_eval::{evaluate_guess, LetterStatus};

/// Games graded one guess at a time.
#[must_use]
pub fn grades_guesses(game_slug: &str) -> bool {
    guess_limit(game_slug).is_some()
}

/// Graded guesses a player gets per puzzle and day: the game's own limit, so
/// CheckGuess cannot be used to search for the answer.
#[must_use]
pub fn guess_limit(game_slug: &str) -> Option<u32> {
    Some(match game_slug {
        "word-guess" | "arithmo" => 6,
        // Four groups plus four mistakes.
        "word-groups" => 8,
        // Nine guesses across four boards.
        "quad-words" => 9,
        // Full-grid checks after edits plus three hints.
        "cryptogram" => 30,
        // Every valid word is a separate find; a generous cap on attempts.
        "word-hive" => 1000,
        _ => return None,
    })
}

/// Grade `guess` (the request's `guess_json`) against the stored solution.
pub fn grade_guess(game_slug: &str, solution: &Value, guess: &Value) -> Result<Value, String> {
    match game_slug {
        "word-guess" => grade_word_guess(solution, guess),
        "word-groups" => grade_word_groups(solution, guess),
        "arithmo" => super::grading::arithmo::grade(solution, guess),
        "cryptogram" => super::grading::cryptogram::grade(solution, guess),
        "quad-words" => super::grading::quad_words::grade(solution, guess),
        "word-hive" => super::grading::word_hive::grade(solution, guess),
        other => Err(format!("{other} is not graded per guess")),
    }
}

/// `{"word":"crane"}` → `{"tiles":[...5 statuses]}`.
fn grade_word_guess(solution: &Value, guess: &Value) -> Result<Value, String> {
    let answer = solution
        .get("word")
        .and_then(Value::as_str)
        .ok_or("missing solution word")?;
    let word = guess
        .get("word")
        .and_then(Value::as_str)
        .ok_or("missing guess word")?
        .trim();
    let statuses = evaluate_guess(word, answer).ok_or("guess must be a five-letter word")?;
    let tiles: Vec<&str> = statuses
        .iter()
        .map(|s| match s {
            LetterStatus::Correct => "correct",
            LetterStatus::Present => "present",
            LetterStatus::Absent => "absent",
        })
        .collect();
    Ok(json!({ "tiles": tiles }))
}

/// `{"words":[4],"solved":[names]}` → `{"correct","oneAway","category"?}`.
/// The category (with its words) is sent only when the guess solves it.
fn grade_word_groups(solution: &Value, guess: &Value) -> Result<Value, String> {
    let categories = solution
        .get("categories")
        .and_then(Value::as_array)
        .ok_or("missing categories")?;
    let words: Vec<String> = guess
        .get("words")
        .and_then(Value::as_array)
        .ok_or("missing guess words")?
        .iter()
        .filter_map(Value::as_str)
        .map(|w| w.trim().to_uppercase())
        .collect();
    if words.len() != 4 {
        return Err("a guess is four words".into());
    }
    let solved: Vec<&str> = guess
        .get("solved")
        .and_then(Value::as_array)
        .map(|names| names.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    let mut best = 0usize;
    for category in categories {
        let name = category.get("name").and_then(Value::as_str).unwrap_or("");
        if solved.contains(&name) {
            continue;
        }
        let members: Vec<String> = category
            .get("words")
            .and_then(Value::as_array)
            .map(|ws| {
                ws.iter()
                    .filter_map(Value::as_str)
                    .map(str::to_uppercase)
                    .collect()
            })
            .unwrap_or_default();
        let matching = words.iter().filter(|w| members.contains(w)).count();
        if matching == 4 {
            return Ok(json!({ "correct": true, "oneAway": false, "category": category }));
        }
        best = best.max(matching);
    }
    Ok(json!({ "correct": false, "oneAway": best == 3 }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_guess_tiles_mark_duplicates_like_wordle() {
        let solution = json!({"word": "APPLE"});
        let graded = grade_guess("word-guess", &solution, &json!({"word": "pappy"})).unwrap();
        assert_eq!(
            graded["tiles"],
            json!(["present", "present", "correct", "absent", "absent"])
        );
        assert!(grade_guess("word-guess", &solution, &json!({"word": "abc"})).is_err());
    }

    #[test]
    fn word_groups_reveal_only_a_solved_category() {
        let solution = json!({"categories": [
            {"name": "Fruit", "level": 0, "words": ["APPLE", "PEAR", "PLUM", "FIG"]},
            {"name": "Birds", "level": 1, "words": ["CROW", "ROBIN", "WREN", "OWL"]}
        ]});
        let hit = grade_guess(
            "word-groups",
            &solution,
            &json!({"words": ["fig", "plum", "pear", "apple"]}),
        )
        .unwrap();
        assert_eq!(hit["correct"], true);
        assert_eq!(hit["category"]["name"], "Fruit");
        let near = grade_guess(
            "word-groups",
            &solution,
            &json!({"words": ["FIG", "PLUM", "PEAR", "CROW"]}),
        )
        .unwrap();
        assert_eq!(near, json!({"correct": false, "oneAway": true}));
        let solved = grade_guess(
            "word-groups",
            &solution,
            &json!({"words": ["FIG", "PLUM", "PEAR", "APPLE"], "solved": ["Fruit"]}),
        )
        .unwrap();
        assert_eq!(
            solved["correct"], false,
            "an already solved group is not solved twice"
        );
    }
}
