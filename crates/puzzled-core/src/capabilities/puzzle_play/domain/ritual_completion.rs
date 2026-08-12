//! Ritual completion contract and DRC recompute oracle (North Star S0).
//!
//! A qualifying finish is produced only after **server-side** play validation
//! (ADR-170). Clients never assert completion. This module is pure: the shell
//! persists the record and recomputes DRC from stored rows.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use super::game_slugs::{is_valid_game_slug, module_class_for, ModuleClass};

/// Terminal finish kind for a ritual run (event contract).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FinishKind {
    /// Server-validated success (`status = won`).
    Success,
    /// Honest terminal fail after rules exhaustion (`status = lost`).
    ExhaustedFail,
    /// Other terminal outcome reserved for future modules.
    OtherTerminal,
}

impl FinishKind {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::ExhaustedFail => "exhausted_fail",
            Self::OtherTerminal => "other_terminal",
        }
    }

    /// Map server session status labels to finish kind.
    #[must_use]
    pub fn from_session_status(status: &str) -> Option<Self> {
        match status.trim().to_ascii_lowercase().as_str() {
            "won" => Some(Self::Success),
            "lost" => Some(Self::ExhaustedFail),
            _ => None,
        }
    }
}

/// Server-authoritative ritual completion record (`ritual.completed` contract).
///
/// Persistence equivalent: `game_sessions` rows with `is_ritual = true`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RitualCompleted {
    pub user_id: String,
    pub game_module_id: String,
    /// `YYYY-MM-DD` in product day-key TZ (`Asia/Hong_Kong`).
    pub day_key: String,
    pub finish_kind: FinishKind,
    pub content_id: Option<String>,
    /// Unix epoch milliseconds (shell fills from clock).
    pub at_ms: i64,
    pub is_ritual: bool,
    pub module_class: ModuleClass,
}

/// Inputs required to decide whether a validated finish qualifies as a ritual.
#[derive(Debug, Clone, Copy)]
pub struct RitualQualifyInput<'a> {
    pub game_module_id: &'a str,
    /// Product mode after server resolution (`daily` | `archive` | `practice`).
    pub mode: &'a str,
    /// Server session status after validation (`won` | `lost` | …).
    pub status: &'a str,
    /// True for dry-run / admin inject / load-test markers (never DRC).
    pub is_dry_run: bool,
}

/// Pure qualification: does this validated finish emit `ritual.completed`?
#[must_use]
pub fn qualifies_as_ritual(input: RitualQualifyInput<'_>) -> bool {
    if input.is_dry_run {
        return false;
    }
    if !is_valid_game_slug(input.game_module_id) {
        return false;
    }
    if !input.mode.trim().eq_ignore_ascii_case("daily") {
        return false;
    }
    if FinishKind::from_session_status(input.status).is_none() {
        return false;
    }
    matches!(
        module_class_for(input.game_module_id),
        Some(ModuleClass::PuzzleRitual)
    )
}

/// Build the event when qualification succeeds.
///
/// `day_key` must already be the **server** product day key (or the content
/// day for that ritual), never a client-supplied authority value.
#[must_use]
pub fn build_ritual_completed(
    user_id: impl Into<String>,
    game_module_id: &str,
    day_key: NaiveDate,
    status: &str,
    content_id: Option<String>,
    at_ms: i64,
) -> Option<RitualCompleted> {
    let finish_kind = FinishKind::from_session_status(status)?;
    let module_class = module_class_for(game_module_id)?;
    if !matches!(module_class, ModuleClass::PuzzleRitual) {
        return None;
    }
    Some(RitualCompleted {
        user_id: user_id.into(),
        game_module_id: game_module_id.to_string(),
        day_key: day_key.format("%Y-%m-%d").to_string(),
        finish_kind,
        content_id,
        at_ms,
        is_ritual: true,
        module_class,
    })
}

/// Compact row shape for DRC recompute from warehouse / Postgres.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RitualCompletionRow {
    pub user_id: String,
    pub day_key: String,
    pub module_class: ModuleClass,
    pub is_ritual: bool,
}

/// Recompute \(\mathrm{DRC}(D)\) = distinct users with ≥1 qualifying ritual finish on day \(D\).
#[must_use]
pub fn compute_drc(day_key: &str, rows: &[RitualCompletionRow]) -> u64 {
    let mut users: Vec<&str> = rows
        .iter()
        .filter(|r| {
            r.is_ritual
                && r.day_key == day_key
                && matches!(r.module_class, ModuleClass::PuzzleRitual)
        })
        .map(|r| r.user_id.as_str())
        .collect();
    users.sort_unstable();
    users.dedup();
    users.len() as u64
}

/// SQL recipe (documentation + live ops) for Postgres DRC recompute.
///
/// Bound `$1` = day_key `YYYY-MM-DD`.
pub const DRC_RECOMPUTE_SQL: &str = r#"
SELECT COUNT(DISTINCT user_id)::bigint AS drc
FROM game_sessions
WHERE day_key = $1
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost')
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    #[test]
    fn daily_won_puzzle_ritual_qualifies() {
        assert!(qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "daily",
            status: "won",
            is_dry_run: false,
        }));
        assert!(qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "word-guess",
            mode: "daily",
            status: "lost",
            is_dry_run: false,
        }));
    }

    #[test]
    fn archive_practice_dry_run_do_not_qualify() {
        assert!(!qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "archive",
            status: "won",
            is_dry_run: false,
        }));
        assert!(!qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "practice",
            status: "won",
            is_dry_run: false,
        }));
        assert!(!qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "daily",
            status: "won",
            is_dry_run: true,
        }));
        assert!(!qualifies_as_ritual(RitualQualifyInput {
            game_module_id: "sudoku",
            mode: "daily",
            status: "abandoned",
            is_dry_run: false,
        }));
    }

    #[test]
    fn build_event_maps_finish_kind() {
        let day = NaiveDate::from_ymd_opt(2026, 8, 12).expect("d");
        let ev = build_ritual_completed(
            "user-1",
            "sudoku",
            day,
            "won",
            Some("puzzle-abc".into()),
            1_723_456_789_000,
        )
        .expect("event");
        assert_eq!(ev.day_key, "2026-08-12");
        assert_eq!(ev.finish_kind, FinishKind::Success);
        assert!(ev.is_ritual);
        assert_eq!(ev.module_class, ModuleClass::PuzzleRitual);
        assert_eq!(ev.game_module_id, "sudoku");

        let lost = build_ritual_completed("user-1", "sudoku", day, "lost", None, 0).expect("lost");
        assert_eq!(lost.finish_kind, FinishKind::ExhaustedFail);
    }

    #[test]
    fn drc_counts_distinct_users_once() {
        let rows = vec![
            RitualCompletionRow {
                user_id: "a".into(),
                day_key: "2026-08-12".into(),
                module_class: ModuleClass::PuzzleRitual,
                is_ritual: true,
            },
            RitualCompletionRow {
                user_id: "a".into(),
                day_key: "2026-08-12".into(),
                module_class: ModuleClass::PuzzleRitual,
                is_ritual: true,
            },
            RitualCompletionRow {
                user_id: "b".into(),
                day_key: "2026-08-12".into(),
                module_class: ModuleClass::PuzzleRitual,
                is_ritual: true,
            },
            RitualCompletionRow {
                user_id: "c".into(),
                day_key: "2026-08-11".into(),
                module_class: ModuleClass::PuzzleRitual,
                is_ritual: true,
            },
            RitualCompletionRow {
                user_id: "d".into(),
                day_key: "2026-08-12".into(),
                module_class: ModuleClass::EntertainmentOracle,
                is_ritual: true,
            },
            RitualCompletionRow {
                user_id: "e".into(),
                day_key: "2026-08-12".into(),
                module_class: ModuleClass::PuzzleRitual,
                is_ritual: false,
            },
        ];
        assert_eq!(compute_drc("2026-08-12", &rows), 2);
        assert_eq!(compute_drc("2026-08-11", &rows), 1);
        assert_eq!(compute_drc("2026-08-10", &rows), 0);
    }

    #[test]
    fn drc_sql_recipe_is_present() {
        assert!(DRC_RECOMPUTE_SQL.contains("day_key"));
        assert!(DRC_RECOMPUTE_SQL.contains("is_ritual"));
        assert!(DRC_RECOMPUTE_SQL.contains("puzzle_ritual"));
    }
}
