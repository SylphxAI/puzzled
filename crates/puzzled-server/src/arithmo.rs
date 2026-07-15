//! Pure arithmo equation validation + score — mirrors
//! `apps/puzzled/src/games/arithmo/types.ts#isValidEquation|getGuessResult` and
//! `config.ts#validateAndScore`.
//! FLEET residual pure deepen. NO authority_rust / ts_deleted.

use crate::game_format::calculate_wordle_score;

/// Fixed equation length (Nerdle-style).
pub const EQUATION_LENGTH: usize = 8;
/// Max attempts.
pub const MAX_ATTEMPTS: u32 = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CharStatus {
    Correct,
    Present,
    Absent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameResult {
    Invalid { error: String },
    Valid {
        status: SubmissionStatus,
        score: u32,
    },
}

impl GameResult {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        matches!(self, Self::Valid { .. })
    }
}

/// Wordle-style char statuses for a guess vs solution.
#[must_use]
pub fn get_guess_result(guess: &str, solution: &str) -> Option<Vec<CharStatus>> {
    if guess.len() != EQUATION_LENGTH || solution.len() != EQUATION_LENGTH {
        return None;
    }
    let guess_chars: Vec<char> = guess.chars().collect();
    let solution_chars: Vec<char> = solution.chars().collect();
    let mut result = [CharStatus::Absent; EQUATION_LENGTH];
    let mut used = [false; EQUATION_LENGTH];

    for i in 0..EQUATION_LENGTH {
        if guess_chars[i] == solution_chars[i] {
            result[i] = CharStatus::Correct;
            used[i] = true;
        }
    }
    for i in 0..EQUATION_LENGTH {
        if result[i] == CharStatus::Correct {
            continue;
        }
        for j in 0..EQUATION_LENGTH {
            if !used[j] && guess_chars[i] == solution_chars[j] {
                result[i] = CharStatus::Present;
                used[j] = true;
                break;
            }
        }
    }
    Some(result.to_vec())
}

fn is_digit(c: char) -> bool {
    c.is_ascii_digit()
}

fn is_op(c: char) -> bool {
    matches!(c, '+' | '-' | '*' | '/')
}

/// Tokenize expression; reject leading zeros on multi-digit numbers.
fn tokenize(expr: &str) -> Option<Vec<String>> {
    let mut tokens: Vec<String> = Vec::new();
    let mut current = String::new();
    for ch in expr.chars() {
        if is_digit(ch) {
            current.push(ch);
        } else if is_op(ch) {
            if !current.is_empty() {
                if current.len() > 1 && current.starts_with('0') {
                    return None;
                }
                tokens.push(std::mem::take(&mut current));
            }
            tokens.push(ch.to_string());
        } else {
            return None;
        }
    }
    if !current.is_empty() {
        if current.len() > 1 && current.starts_with('0') {
            return None;
        }
        tokens.push(current);
    }
    Some(tokens)
}

/// Evaluate + - * / expression with standard precedence; reject div-by-zero.
fn evaluate_expression(expr: &str) -> Option<f64> {
    if !expr.chars().all(|c| is_digit(c) || is_op(c)) {
        return None;
    }
    // mirror TS: /0, /00, trailing /0
    if expr.ends_with("/0") {
        return None;
    }
    let bytes = expr.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'/' {
            let mut j = i + 1;
            while j < bytes.len() && bytes[j] == b'0' {
                j += 1;
            }
            // /0 not followed by more digits → div by zero
            if j > i + 1 && (j == bytes.len() || !bytes[j].is_ascii_digit()) {
                return None;
            }
        }
        i += 1;
    }

    // recursive descent: expr = term ((+|-) term)*
    // term = factor ((*|/) factor)*
    // factor = number
    let chars: Vec<char> = expr.chars().collect();
    let mut pos = 0usize;

    fn parse_number(chars: &[char], pos: &mut usize) -> Option<f64> {
        if *pos >= chars.len() || !chars[*pos].is_ascii_digit() {
            return None;
        }
        let start = *pos;
        while *pos < chars.len() && chars[*pos].is_ascii_digit() {
            *pos += 1;
        }
        let s: String = chars[start..*pos].iter().collect();
        if s.len() > 1 && s.starts_with('0') {
            return None;
        }
        s.parse().ok()
    }

    fn parse_factor(chars: &[char], pos: &mut usize) -> Option<f64> {
        parse_number(chars, pos)
    }

    fn parse_term(chars: &[char], pos: &mut usize) -> Option<f64> {
        let mut val = parse_factor(chars, pos)?;
        while *pos < chars.len() {
            let op = chars[*pos];
            if op != '*' && op != '/' {
                break;
            }
            *pos += 1;
            let rhs = parse_factor(chars, pos)?;
            if op == '*' {
                val *= rhs;
            } else {
                if rhs == 0.0 {
                    return None;
                }
                val /= rhs;
            }
        }
        Some(val)
    }

    fn parse_expr(chars: &[char], pos: &mut usize) -> Option<f64> {
        let mut val = parse_term(chars, pos)?;
        while *pos < chars.len() {
            let op = chars[*pos];
            if op != '+' && op != '-' {
                break;
            }
            *pos += 1;
            let rhs = parse_term(chars, pos)?;
            if op == '+' {
                val += rhs;
            } else {
                val -= rhs;
            }
        }
        Some(val)
    }

    let val = parse_expr(&chars, &mut pos)?;
    if pos != chars.len() {
        return None;
    }
    if !val.is_finite() {
        return None;
    }
    Some(val)
}

/// Check if equation is mathematically valid (mirrors TS `isValidEquation`).
#[must_use]
pub fn is_valid_equation(equation: &str) -> bool {
    if equation.len() != EQUATION_LENGTH {
        return false;
    }
    if !equation.contains('=') {
        return false;
    }
    let parts: Vec<&str> = equation.split('=').collect();
    if parts.len() != 2 {
        return false;
    }
    let (left, right) = (parts[0], parts[1]);
    if left.is_empty() || right.is_empty() {
        return false;
    }
    if tokenize(left).is_none() || tokenize(right).is_none() {
        return false;
    }
    let Some(lv) = evaluate_expression(left) else {
        return false;
    };
    let Some(rv) = evaluate_expression(right) else {
        return false;
    };
    (lv - rv).abs() < 0.0001
}

/// Attempt-based score via shared Wordle formula.
#[must_use]
pub fn arithmo_score(won: bool, attempts: u32) -> u32 {
    calculate_wordle_score(won, attempts)
}

/// Validate guesses array + win/loss claim against solution equation.
#[must_use]
pub fn validate_and_score(
    solution_equation: &str,
    guesses: Option<&[String]>,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(guesses) = guesses else {
        return GameResult::Invalid {
            error: "Missing guesses data".into(),
        };
    };
    if guesses.is_empty() {
        return GameResult::Invalid {
            error: "Missing guesses data".into(),
        };
    }

    for guess in guesses {
        if !is_valid_equation(guess) {
            return GameResult::Invalid {
                error: format!("Invalid equation in guesses: {guess}"),
            };
        }
    }

    let last = guesses.last().map(String::as_str).unwrap_or("");
    let won = last == solution_equation;

    if claimed == SubmissionStatus::Won && !won {
        return GameResult::Invalid {
            error: "Invalid win claim - final guess does not match solution".into(),
        };
    }
    if claimed == SubmissionStatus::Lost && won {
        return GameResult::Invalid {
            error: "Invalid loss claim - final guess matches solution".into(),
        };
    }

    let attempts = guesses.len() as u32;
    GameResult::Valid {
        status: if won {
            SubmissionStatus::Won
        } else {
            SubmissionStatus::Lost
        },
        score: arithmo_score(won, attempts),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_equations() {
        assert!(is_valid_equation("12+34=46"));
        assert!(is_valid_equation("56-32=24"));
        assert!(is_valid_equation("10+20=30"));
        assert!(is_valid_equation("99-11=88"));
        assert!(is_valid_equation("15+25=40"));
        assert!(is_valid_equation("80-40=40"));
        assert!(!is_valid_equation("notanequ"));
        assert!(!is_valid_equation("abc=xyzz"));
        assert!(!is_valid_equation("12+34=99"));
        assert!(!is_valid_equation("1+2=3")); // wrong length
    }

    #[test]
    fn score_table() {
        assert_eq!(arithmo_score(true, 1), 100);
        assert_eq!(arithmo_score(true, 2), 85);
        assert_eq!(arithmo_score(true, 3), 70);
        assert_eq!(arithmo_score(true, 4), 55);
        assert_eq!(arithmo_score(true, 5), 40);
        assert_eq!(arithmo_score(true, 6), 25);
        assert_eq!(arithmo_score(false, 6), 0);
    }

    #[test]
    fn guess_result_all_correct() {
        match get_guess_result("12+34=46", "12+34=46") {
            Some(r) => assert!(r.iter().all(|s| *s == CharStatus::Correct)),
            None => panic!("same-length guess must yield statuses"),
        }
    }

    #[test]
    fn validate_win_loss() {
        let sol = "12+34=46";
        let win = validate_and_score(
            sol,
            Some(&[sol.to_string()]),
            SubmissionStatus::Won,
        );
        assert_eq!(
            win,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
        let two = validate_and_score(
            sol,
            Some(&["56-32=24".into(), sol.into()]),
            SubmissionStatus::Won,
        );
        assert_eq!(
            two,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 85
            }
        );
        let loss = validate_and_score(
            sol,
            Some(&[
                "56-32=24".into(),
                "10+20=30".into(),
                "99-11=88".into(),
                "15+25=40".into(),
                "80-40=40".into(),
                "11+22=33".into(),
            ]),
            SubmissionStatus::Lost,
        );
        assert_eq!(
            loss,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let false_win = validate_and_score(
            sol,
            Some(&["56-32=24".into()]),
            SubmissionStatus::Won,
        );
        assert!(!false_win.is_valid());
        let bad = validate_and_score(
            sol,
            Some(&["notanequ".into(), sol.into()]),
            SubmissionStatus::Won,
        );
        assert!(!bad.is_valid());
        let missing = validate_and_score(sol, None, SubmissionStatus::Won);
        assert!(!missing.is_valid());
    }
}
