//! Frozen seed-based puzzle grid generation (ADR-168 S2).
//!
//! Ports TypeScript generators from `apps/puzzled/src/games/shared/random.ts` and
//! `apps/puzzled/src/games/sudoku/generator.ts` for golden fixture parity.

pub mod random;
pub mod scoring;
pub mod sudoku;

pub use random::{seeded_random, shuffle_array, SeededRandom};
pub use scoring::{
    validate_and_score_sudoku, GameSubmission, ScoringResult, SubmissionStatus,
};
pub use sudoku::{
    generate_sudoku_puzzle, SudokuDifficulty, SudokuPuzzleResult, SudokuSolution,
};