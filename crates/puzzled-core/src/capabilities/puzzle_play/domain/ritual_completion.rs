//! Ritual completion contract and recompute oracles (North Star S0).
//!
//! A qualifying finish is produced only after **server-side** play validation
//! (ADR-170). Clients never assert completion. This module is pure: the shell
//! persists the record and recomputes **daily puzzle completers** plus the
//! supporting habit oracle **weekly ritualists** (`compute_hrc`, 4-of-7).
//! Do not mint a house score acronym (including DPC) for either quantity.

use std::collections::BTreeMap;

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
    /// True for dry-run / admin inject / load-test markers (never daily puzzle completers).
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

/// Compact row shape for daily puzzle completers / weekly ritualists recompute.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RitualCompletionRow {
    pub user_id: String,
    pub day_key: String,
    pub module_class: ModuleClass,
    pub is_ritual: bool,
}

/// Trailing window length (product days) for weekly ritualists (`compute_hrc`).
pub const HABITUAL_WINDOW_DAYS: i64 = 7;

/// Minimum distinct daily-puzzle-completer days inside [`HABITUAL_WINDOW_DAYS`].
pub const HABITUAL_MIN_DAYS: u32 = 4;

/// Public English field for the supporting habit oracle (not the executive NSM).
pub const WEEKLY_RITUALISTS_FIELD: &str = "weekly_ritualists";

/// Recompute `daily_puzzle_completers(D)` = distinct users with ≥1 qualifying ritual finish on day `D`.
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

/// SQL recipe (documentation + live ops) for Postgres daily puzzle completers recompute.
///
/// Bound `$1` = day_key `YYYY-MM-DD`. Public metric field: `daily_puzzle_completers`.
pub const DRC_RECOMPUTE_SQL: &str = r#"
SELECT COUNT(DISTINCT user_id)::bigint AS daily_puzzle_completers
FROM game_sessions
WHERE day_key = $1
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost')
"#;

/// Per-module qualifying ritual finish counts for a product day.
///
/// Bound `$1` = day_key `YYYY-MM-DD`. Same qualification as [`DRC_RECOMPUTE_SQL`].
pub const DRC_MODULE_COMPLETIONS_SQL: &str = r#"
SELECT game_slug, COUNT(*)::bigint AS count
FROM game_sessions
WHERE day_key = $1
  AND is_ritual = true
  AND module_class = 'puzzle_ritual'
  AND status IN ('won', 'lost')
GROUP BY game_slug
ORDER BY game_slug
"#;

/// Compact row shape for the product-day overview read model.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RitualOverviewRow {
    pub user_id: String,
    pub day_key: String,
    pub game_module_id: String,
    pub module_class: ModuleClass,
    pub is_ritual: bool,
}

impl RitualOverviewRow {
    #[must_use]
    pub fn completion_row(&self) -> RitualCompletionRow {
        RitualCompletionRow {
            user_id: self.user_id.clone(),
            day_key: self.day_key.clone(),
            module_class: self.module_class,
            is_ritual: self.is_ritual,
        }
    }
}

/// Product read model for today's ritual: daily puzzle completers plus
/// per-module qualifying finish counts on the same product day.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TodayOverview {
    pub player_count: u64,
    pub completions: Vec<(String, u64)>,
}

/// Recompute `GetTodayOverview` from canonical qualifying ritual rows.
///
/// `player_count` is [`compute_drc`] for `day_key`. Archive, practice,
/// entertainment, dry-run, and non-ritual won-lost rows do not count.
#[must_use]
pub fn compute_today_overview(day_key: &str, rows: &[RitualOverviewRow]) -> TodayOverview {
    let completion_rows: Vec<RitualCompletionRow> =
        rows.iter().map(RitualOverviewRow::completion_row).collect();
    let player_count = compute_drc(day_key, &completion_rows);
    let mut counts: BTreeMap<String, u64> = BTreeMap::new();
    for row in rows {
        if row.is_ritual
            && row.day_key == day_key
            && matches!(row.module_class, ModuleClass::PuzzleRitual)
        {
            *counts.entry(row.game_module_id.clone()).or_insert(0) += 1;
        }
    }
    TodayOverview {
        player_count,
        completions: counts.into_iter().collect(),
    }
}

/// Recompute weekly ritualists ending on `end_day_key`.
///
/// Distinct users with ≥ [`HABITUAL_MIN_DAYS`] distinct daily-puzzle-completer
/// days in the trailing [`HABITUAL_WINDOW_DAYS`] ending on `end_day_key`.
/// Invalid `end_day_key` yields `0` (uncomputable is not a fake habit win).
///
/// Domain helper name [`compute_hrc`] is the supporting oracle identity.
/// Public English field: [`WEEKLY_RITUALISTS_FIELD`]. Do not invent DPC.
#[must_use]
pub fn compute_hrc(end_day_key: &str, rows: &[RitualCompletionRow]) -> u64 {
    let Ok(end) = NaiveDate::parse_from_str(end_day_key, "%Y-%m-%d") else {
        return 0;
    };
    let start = end - chrono::Duration::days(HABITUAL_WINDOW_DAYS - 1);
    let mut pairs: Vec<(&str, &str)> = rows
        .iter()
        .filter(|r| r.is_ritual && matches!(r.module_class, ModuleClass::PuzzleRitual))
        .filter(|r| {
            NaiveDate::parse_from_str(&r.day_key, "%Y-%m-%d")
                .ok()
                .is_some_and(|d| d >= start && d <= end)
        })
        .map(|r| (r.user_id.as_str(), r.day_key.as_str()))
        .collect();
    pairs.sort_unstable();
    pairs.dedup();
    let mut weekly_ritualists = 0_u64;
    let mut i = 0;
    while i < pairs.len() {
        let user = pairs[i].0;
        let mut j = i;
        while j < pairs.len() && pairs[j].0 == user {
            j += 1;
        }
        if (j - i) as u32 >= HABITUAL_MIN_DAYS {
            weekly_ritualists += 1;
        }
        i = j;
    }
    weekly_ritualists
}

/// English public alias of [`compute_hrc`].
#[must_use]
pub fn compute_weekly_ritualists(end_day_key: &str, rows: &[RitualCompletionRow]) -> u64 {
    compute_hrc(end_day_key, rows)
}

/// SQL recipe (documentation + live ops) for Postgres weekly ritualists recompute.
///
/// Bound `$1` = end day_key `YYYY-MM-DD`. Window is `$1-6` … `$1` inclusive;
/// threshold is [`HABITUAL_MIN_DAYS`] distinct daily-puzzle-completer days.
/// Public metric field: `weekly_ritualists`.
pub const HRC_RECOMPUTE_SQL: &str = r#"
WITH daily AS (
  SELECT user_id, day_key
  FROM game_sessions
  WHERE is_ritual = true
    AND module_class = 'puzzle_ritual'
    AND status IN ('won', 'lost')
    AND day_key >= to_char(($1::date - 6), 'YYYY-MM-DD')
    AND day_key <= $1
  GROUP BY user_id, day_key
)
SELECT COUNT(*)::bigint AS weekly_ritualists
FROM (
  SELECT user_id
  FROM daily
  GROUP BY user_id
  HAVING COUNT(*) >= 4
) t
"#;

/// Product floor: free daily ritual admits **one** terminal finish per
/// `(user_id, game_module_id, day_key)` — independent of whether a stable
/// `puzzle_id` / content store row exists.
///
/// Shell enforces this via session pre-check + partial unique index; this pure
/// helper is the decision contract (and regression oracle for dogfood).
#[must_use]
pub fn ritual_already_finished(
    prior: &[RitualCompletionRow],
    user_id: &str,
    day_key: &str,
    game_module_id: &str,
) -> bool {
    if !is_valid_game_slug(game_module_id) {
        return false;
    }
    if !matches!(
        module_class_for(game_module_id),
        Some(ModuleClass::PuzzleRitual)
    ) {
        return false;
    }
    prior.iter().any(|r| {
        r.is_ritual
            && r.user_id == user_id
            && r.day_key == day_key
            && matches!(r.module_class, ModuleClass::PuzzleRitual)
    })
}

/// Whether SubmitGuess must run a completion pre-check for this resolve path.
///
/// Always true when a DB is available and a content day is known — **including**
/// when `resolved_puzzle_id` is `None` (deterministic sudoku). The historical
/// bug only gated on `resolved_puzzle_id.is_some()`.
#[must_use]
pub fn submit_must_guard_already_played(
    has_session_store: bool,
    resolved_puzzle_id: Option<&str>,
    content_day_known: bool,
) -> bool {
    let _ = resolved_puzzle_id; // intentionally unused — guard is not pid-gated
    has_session_store && content_day_known
}

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
    fn daily_puzzle_completers_counts_distinct_users_once() {
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

    fn overview_row(
        user: &str,
        day: &str,
        module: &str,
        class: ModuleClass,
        is_ritual: bool,
    ) -> RitualOverviewRow {
        RitualOverviewRow {
            user_id: user.into(),
            day_key: day.into(),
            game_module_id: module.into(),
            module_class: class,
            is_ritual,
        }
    }

    #[test]
    fn today_overview_matches_drc_on_ritual_product_day() {
        let rows = vec![
            overview_row("a", "2026-08-12", "sudoku", ModuleClass::PuzzleRitual, true),
            overview_row(
                "a",
                "2026-08-12",
                "crossword",
                ModuleClass::PuzzleRitual,
                true,
            ),
            overview_row("b", "2026-08-12", "sudoku", ModuleClass::PuzzleRitual, true),
            overview_row("c", "2026-08-11", "sudoku", ModuleClass::PuzzleRitual, true),
            overview_row(
                "d",
                "2026-08-12",
                "oracle",
                ModuleClass::EntertainmentOracle,
                true,
            ),
            // Calendar CURRENT_DATE won-lost residue: not ritual, must not count.
            overview_row(
                "e",
                "2026-08-12",
                "sudoku",
                ModuleClass::PuzzleRitual,
                false,
            ),
        ];
        let overview = compute_today_overview("2026-08-12", &rows);
        let drc_rows: Vec<RitualCompletionRow> =
            rows.iter().map(RitualOverviewRow::completion_row).collect();
        assert_eq!(overview.player_count, compute_drc("2026-08-12", &drc_rows));
        assert_eq!(overview.player_count, 2);
        assert_eq!(
            overview.completions,
            vec![("crossword".into(), 1), ("sudoku".into(), 2)]
        );
        assert_eq!(compute_today_overview("2026-08-10", &rows).player_count, 0);
    }

    fn row(user: &str, day: &str, class: ModuleClass, is_ritual: bool) -> RitualCompletionRow {
        RitualCompletionRow {
            user_id: user.into(),
            day_key: day.into(),
            module_class: class,
            is_ritual,
        }
    }

    #[test]
    fn weekly_ritualists_counts_users_with_four_distinct_days_in_window() {
        let rows = vec![
            row("a", "2026-08-08", ModuleClass::PuzzleRitual, true),
            row("a", "2026-08-09", ModuleClass::PuzzleRitual, true),
            row("a", "2026-08-10", ModuleClass::PuzzleRitual, true),
            row("a", "2026-08-11", ModuleClass::PuzzleRitual, true),
            // b has only 3 days
            row("b", "2026-08-10", ModuleClass::PuzzleRitual, true),
            row("b", "2026-08-11", ModuleClass::PuzzleRitual, true),
            row("b", "2026-08-12", ModuleClass::PuzzleRitual, true),
            // c has 4 finishes on the SAME day — one daily-puzzle-completer day
            row("c", "2026-08-12", ModuleClass::PuzzleRitual, true),
            row("c", "2026-08-12", ModuleClass::PuzzleRitual, true),
            row("c", "2026-08-12", ModuleClass::PuzzleRitual, true),
            row("c", "2026-08-12", ModuleClass::PuzzleRitual, true),
            // d's fourth day is outside the window ending 2026-08-12
            row("d", "2026-08-05", ModuleClass::PuzzleRitual, true),
            row("d", "2026-08-10", ModuleClass::PuzzleRitual, true),
            row("d", "2026-08-11", ModuleClass::PuzzleRitual, true),
            row("d", "2026-08-12", ModuleClass::PuzzleRitual, true),
            // e is entertainment only
            row("e", "2026-08-09", ModuleClass::EntertainmentOracle, true),
            row("e", "2026-08-10", ModuleClass::EntertainmentOracle, true),
            row("e", "2026-08-11", ModuleClass::EntertainmentOracle, true),
            row("e", "2026-08-12", ModuleClass::EntertainmentOracle, true),
            // f has 4 days including non-contiguous skips
            row("f", "2026-08-06", ModuleClass::PuzzleRitual, true),
            row("f", "2026-08-08", ModuleClass::PuzzleRitual, true),
            row("f", "2026-08-10", ModuleClass::PuzzleRitual, true),
            row("f", "2026-08-12", ModuleClass::PuzzleRitual, true),
        ];
        // Window ending 12th: 6..12. a (8-11)=4, f (6,8,10,12)=4. b=3, c=1, d=3 in-window, e=0.
        assert_eq!(compute_hrc("2026-08-12", &rows), 2);
        assert_eq!(compute_weekly_ritualists("2026-08-12", &rows), 2);
        assert_eq!(compute_hrc("2026-08-11", &rows), 1); // only a; f has 6,8,10 = 3 in [5..11]
        assert_eq!(compute_hrc("not-a-date", &rows), 0);
        assert_eq!(HABITUAL_MIN_DAYS, 4);
        assert_eq!(HABITUAL_WINDOW_DAYS, 7);
        assert_eq!(WEEKLY_RITUALISTS_FIELD, "weekly_ritualists");
    }

    /// Dogfood residual: first free-daily win with null content_id must still
    /// block a second finish the same user/day (daily puzzle completers stay distinct-users, but
    /// product one-finish-per-day was soft).
    #[test]
    fn free_daily_second_finish_blocked_without_puzzle_id() {
        let day = "2026-08-12";
        let user = "f715210b-9df3-4945-b5bd-94fc4609bc30";
        let prior = [RitualCompletionRow {
            user_id: user.into(),
            day_key: day.into(),
            module_class: ModuleClass::PuzzleRitual,
            is_ritual: true,
        }];
        // Guard must not depend on content/puzzle id.
        assert!(submit_must_guard_already_played(true, None, true));
        assert!(submit_must_guard_already_played(
            true,
            Some("optional-id"),
            true
        ));
        assert!(!submit_must_guard_already_played(false, None, true));
        assert!(!submit_must_guard_already_played(true, None, false));

        assert!(ritual_already_finished(&prior, user, day, "sudoku"));
        // Second submit same day/module is rejected by policy.
        assert!(ritual_already_finished(&prior, user, day, "sudoku"));
        // Different day is open.
        assert!(!ritual_already_finished(
            &prior,
            user,
            "2026-08-13",
            "sudoku"
        ));
        // Different user is open.
        assert!(!ritual_already_finished(
            &prior,
            "other-user",
            day,
            "sudoku"
        ));
    }
}
