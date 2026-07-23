//! Capability `puzzle_play` functional core.


pub mod domain;
pub mod application;

pub use domain::arithmo;
pub use domain::block_slide;
pub use domain::crossword_grid;
pub use domain::cryptogram;
pub use domain::daily_time;
pub use domain::game_format;
pub use domain::game_slugs;
pub use domain::killer_sudoku;
pub use domain::nonogram_clues;
pub use domain::pattern_match;
pub use domain::placement;
pub use domain::quad_words;
pub use domain::queens_conflict;
pub use domain::random;
pub use domain::random_lcg;
pub use domain::scoring;
pub use domain::share_squares;
pub use domain::sudoku;
pub use domain::sudoku_scoring;
pub use domain::tango;
pub use domain::word_box;
pub use domain::word_groups;
pub use domain::word_hive;
pub use domain::word_ladder;
pub use domain::word_search;
pub use domain::wordle_eval;
pub use application::game_flows;

