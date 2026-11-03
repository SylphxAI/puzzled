//! Closed-day alert policy. All inputs are aggregates; sparse baselines are
//! not failures and missing observations are never fabricated as zero rates.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Day {
    pub day_key: String,
    pub complete: bool,
    pub daily_puzzle_completers: i64,
    pub signed_in_completers: i64,
    pub daily_entertainment_completers: i64,
    pub weekly_ritualists: i64,
    pub d7_cohort: i64,
    pub d7_returned: i64,
    pub share_landings: i64,
    pub share_landing_completers: i64,
    pub shares: i64,
    pub free_finish_ok: i64,
    pub free_finish_failed: i64,
    pub paid_active: i64,
    pub paid_completers: i64,
    pub free_active: i64,
    pub free_completers: i64,
    pub catalog_size: i64,
    pub release: String,
    pub alerts: Vec<String>,
}

pub fn alerts(
    day: &Day,
    previous: Option<&Day>,
    week_ago: Option<&Day>,
    explained: bool,
) -> Vec<String> {
    let mut alerts = Vec::new();
    let mut add = |name: &str, active: bool| {
        if active {
            alerts.push(name.to_owned());
        }
    };
    if let Some(p) = previous {
        add(
            "completers_drop",
            !explained
                && p.daily_puzzle_completers >= 20
                && day.daily_puzzle_completers * 100 < p.daily_puzzle_completers * 80,
        );
        add(
            "share_rate_collapse",
            p.shares >= 20
                && p.daily_puzzle_completers > 0
                && day.daily_puzzle_completers > 0
                && (day.shares as f64 / day.daily_puzzle_completers as f64)
                    < 0.5 * (p.shares as f64 / p.daily_puzzle_completers as f64),
        );
    }
    let attempts = day.free_finish_ok + day.free_finish_failed;
    add(
        "free_finish_errors",
        day.free_finish_failed >= 5 && day.free_finish_failed * 100 > attempts,
    );
    add(
        "paid_completion_gap",
        day.paid_active >= 20
            && day.free_active >= 20
            && (day.paid_completers as f64 / day.paid_active as f64)
                < 0.5 * (day.free_completers as f64 / day.free_active as f64),
    );
    add(
        "entertainment_drift",
        day.daily_entertainment_completers >= 20
            && day.daily_entertainment_completers > 3 * day.daily_puzzle_completers,
    );
    if let Some(p) = week_ago {
        add(
            "catalog_without_habit",
            p.catalog_size > 0
                && day.catalog_size > p.catalog_size
                && p.daily_puzzle_completers >= 20
                && day.daily_puzzle_completers <= p.daily_puzzle_completers,
        );
    }
    add(
        "shares_without_landings",
        day.shares >= 20 && day.share_landings == 0,
    );
    alerts
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_stop_the_line_signal_fires_and_explanations_only_suppress_the_drop() {
        let previous = Day {
            daily_puzzle_completers: 100,
            shares: 40,
            catalog_size: 19,
            ..Day::default()
        };
        let day = Day {
            daily_puzzle_completers: 70,
            shares: 0,
            free_finish_ok: 95,
            free_finish_failed: 5,
            paid_active: 20,
            paid_completers: 1,
            free_active: 20,
            free_completers: 10,
            daily_entertainment_completers: 220,
            catalog_size: 20,
            ..Day::default()
        };
        let a = alerts(&day, Some(&previous), Some(&previous), false);
        assert_eq!(a.len(), 6);
        assert!(a.contains(&"share_rate_collapse".into()));
        assert_eq!(
            alerts(&day, Some(&previous), Some(&previous), true).len(),
            5
        );
        let no_landing = Day {
            shares: 20,
            ..Day::default()
        };
        assert!(alerts(&no_landing, None, None, false).contains(&"shares_without_landings".into()));
    }
    #[test]
    fn sparse_baselines_and_boundary_values_do_not_page() {
        assert!(alerts(&Day::default(), None, None, false).is_empty());
        let p = Day {
            daily_puzzle_completers: 20,
            shares: 20,
            ..Day::default()
        };
        let day = Day {
            daily_puzzle_completers: 16,
            shares: 8,
            share_landings: 1,
            free_finish_ok: 495,
            free_finish_failed: 5,
            ..Day::default()
        };
        assert!(alerts(&day, Some(&p), None, false).is_empty());
    }
}
