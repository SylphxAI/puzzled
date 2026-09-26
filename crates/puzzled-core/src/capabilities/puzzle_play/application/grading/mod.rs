//! Per-game server grading for games whose in-game feedback needs the answer
//! (`PuzzleService.CheckGuess`). Each module exposes
//! `grade(solution, guess) -> result`.

pub mod arithmo;
pub mod cryptogram;
pub mod quad_words;
pub mod word_hive;
