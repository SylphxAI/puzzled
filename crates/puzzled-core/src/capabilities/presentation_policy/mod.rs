//! Presentation parity kernel (dual-oracle constants).
//!
//! Not an independent product capability promise (ADR-170). These pure constants
//! exist for cross-language parity tests only; they are not a backend surface.

pub mod domain;

pub use domain::analytics_timing;
pub use domain::game_color_themes;
pub use domain::motion_duration;
pub use domain::motion_easing;
pub use domain::reduced_motion;
pub use domain::region_colors;
pub use domain::session_replay_timing;
pub use domain::web_vitals_thresholds;
