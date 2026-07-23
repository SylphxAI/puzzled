//! Pure leaderboard entry enrichment — mirrors
//! `apps/puzzled/src/server/api/routes/stats.ts` GET /leaderboard mapping after DB rank.
//! PORTFOLIO-PRODUCTS pure residual. NO authority_rust / ts_deleted.
//!
//! DB IO stays in `leaderboard_db`; this module owns only pure shape + display fallbacks.

use std::collections::HashMap;

use uuid::Uuid;


/// Ranked leaderboard row after pure display enrichment.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: Uuid,
    pub user_name: Option<String>,
    pub user_image: Option<String>,
    pub value: i32,
}

/// Anonymous display name when cache has no display_name (TS: `?? 'Anonymous'`).
pub const ANONYMOUS_DISPLAY_NAME: &str = "Anonymous";

/// Cache period bucket used by TS Redis keys / TTL selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaderboardCachePeriod {
    Daily,
    Weekly,
    All,
}

impl LeaderboardCachePeriod {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Daily => "daily",
            Self::Weekly => "weekly",
            Self::All => "all",
        }
    }

    /// TTL seconds matching `LEADERBOARD_CACHE_TTL` in stats.ts.
    #[must_use]
    pub fn ttl_secs(self) -> u64 {
        match self {
            Self::Daily => 60 * 5,
            Self::Weekly => 60 * 15,
            Self::All => 60 * 60,
        }
    }
}

/// Map query period (`today`/`week`/`all`) to cache period bucket.
#[must_use]
pub fn cache_period_for(period: &str) -> Option<LeaderboardCachePeriod> {
    match period {
        "today" => Some(LeaderboardCachePeriod::Daily),
        "week" => Some(LeaderboardCachePeriod::Weekly),
        "all" => Some(LeaderboardCachePeriod::All),
        _ => None,
    }
}

/// Display fields joined from `user_display_cache` (or absent).
#[derive(Debug, Clone, Default)]
pub struct DisplayFields {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

/// One ranked score row before display enrich (DB aggregate).
#[derive(Debug, Clone)]
pub struct RankScore {
    pub user_id: Uuid,
    pub total_score: i32,
}

/// Resolve display name with Anonymous fallback (TS enrich rule).
#[must_use]
pub fn display_name_or_anonymous(display_name: Option<&str>) -> String {
    match display_name {
        Some(name) if !name.is_empty() => name.to_string(),
        _ => ANONYMOUS_DISPLAY_NAME.to_string(),
    }
}

/// Rank is 1-based index into ordered better-count (TS: `betterUsers.length + 1`).
#[must_use]
pub fn rank_from_better_count(better_count: usize) -> i32 {
    i32::try_from(better_count.saturating_add(1)).unwrap_or(i32::MAX)
}

/// Pure enrich: ordered rank rows + display map → leaderboard entries.
///
/// Parity with:
/// ```text
/// rankings.map((r, i) => ({
///   rank: i + 1,
///   userId: r.userId,
///   userName: displayData[r.userId]?.displayName ?? 'Anonymous',
///   userImage: displayData[r.userId]?.avatarUrl ?? null,
///   value: r.value,
/// }))
/// ```
#[must_use]
pub fn enrich_leaderboard_entries(
    rankings: &[RankScore],
    display: &HashMap<Uuid, DisplayFields>,
) -> Vec<LeaderboardEntry> {
    rankings
        .iter()
        .enumerate()
        .map(|(index, row)| {
            let fields = display.get(&row.user_id);
            let user_name = Some(display_name_or_anonymous(
                fields.and_then(|f| f.display_name.as_deref()),
            ));
            let user_image = fields.and_then(|f| f.avatar_url.clone());
            LeaderboardEntry {
                rank: i32::try_from(index + 1).unwrap_or(i32::MAX),
                user_id: row.user_id,
                user_name,
                user_image,
                value: row.total_score,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn uid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    #[test]
    fn anonymous_when_missing_or_empty() {
        assert_eq!(display_name_or_anonymous(None), "Anonymous");
        assert_eq!(display_name_or_anonymous(Some("")), "Anonymous");
        assert_eq!(display_name_or_anonymous(Some("Ada")), "Ada");
    }

    #[test]
    fn cache_period_and_ttl_match_ts() {
        assert_eq!(
            cache_period_for("today"),
            Some(LeaderboardCachePeriod::Daily)
        );
        assert_eq!(
            cache_period_for("week"),
            Some(LeaderboardCachePeriod::Weekly)
        );
        assert_eq!(cache_period_for("all"), Some(LeaderboardCachePeriod::All));
        assert_eq!(cache_period_for("month"), None);
        assert_eq!(LeaderboardCachePeriod::Daily.ttl_secs(), 300);
        assert_eq!(LeaderboardCachePeriod::Weekly.ttl_secs(), 900);
        assert_eq!(LeaderboardCachePeriod::All.ttl_secs(), 3600);
    }

    #[test]
    fn rank_from_better_is_one_based() {
        assert_eq!(rank_from_better_count(0), 1);
        assert_eq!(rank_from_better_count(4), 5);
    }

    #[test]
    fn enrich_assigns_rank_and_display_fallback() {
        let a = uid(1);
        let b = uid(2);
        let rankings = vec![
            RankScore {
                user_id: a,
                total_score: 900,
            },
            RankScore {
                user_id: b,
                total_score: 100,
            },
        ];
        let mut display = HashMap::new();
        display.insert(
            a,
            DisplayFields {
                display_name: Some("Top".into()),
                avatar_url: Some("https://img/a".into()),
            },
        );
        // b intentionally missing from display map

        let entries = enrich_leaderboard_entries(&rankings, &display);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].rank, 1);
        assert_eq!(entries[0].user_name.as_deref(), Some("Top"));
        assert_eq!(entries[0].user_image.as_deref(), Some("https://img/a"));
        assert_eq!(entries[0].value, 900);
        assert_eq!(entries[1].rank, 2);
        assert_eq!(entries[1].user_name.as_deref(), Some("Anonymous"));
        assert_eq!(entries[1].user_image, None);
        assert_eq!(entries[1].value, 100);
    }

    #[test]
    fn empty_rankings_yield_empty() {
        let entries = enrich_leaderboard_entries(&[], &HashMap::new());
        assert!(entries.is_empty());
    }
}
