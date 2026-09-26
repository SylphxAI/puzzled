//! Puzzled functional core (ADR-169).
//!
//! Capability-first pure domain and pure application decisions.
//! No HTTP, SQL, process env, or wall-clock effects.

pub mod capabilities;

// ---- Stable root re-exports (ADR-168 contract surface) ----
pub use capabilities::puzzle_play::random::{seeded_random, shuffle_array, SeededRandom};
pub use capabilities::puzzle_play::sudoku::{
    generate_sudoku_puzzle, SudokuDifficulty, SudokuPuzzleResult, SudokuSolution,
};
pub use capabilities::puzzle_play::sudoku_scoring::{
    validate_and_score_sudoku, GameSubmission, ScoringResult, SubmissionStatus,
};

// Capability roots for shell/application imports
pub use capabilities::billing_access;
pub use capabilities::gamification;
pub use capabilities::identity_policy;
pub use capabilities::jobs_policy;
pub use capabilities::leaderboard;
pub use capabilities::presentation_policy;
pub use capabilities::privacy;
pub use capabilities::product_policy;
pub use capabilities::puzzle_play;
