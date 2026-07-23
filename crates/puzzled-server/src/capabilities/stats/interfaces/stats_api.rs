//! Hono stats domain product residual beyond leaderboard-read
//! (`api-v1-hono-monolith` /stats/* residual).
//!
//! Ports pure percentile compare + aggregate shaping from
//! `apps/puzzled/src/server/api/routes/stats.ts`. DB-backed reads remain
//! optional dual-path residual; streak rankings stay Platform SDK oracle.

use axum::extract::Query;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

use puzzled_core::puzzle_play::game_slugs::is_valid_game_slug;

/// Owned form for HTTP / aggregation.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PercentileStatsOwned {
    pub status: Option<String>,
    pub score: Option<i32>,
    pub attempts: Option<i32>,
    pub mistakes: Option<i32>,
    pub time_spent_ms: Option<i64>,
}

/// Default percentile compare (parity: `defaultCompare` in stats.ts).
///
/// Wins rank above non-wins; then higher score wins (positive means `a` better).
#[must_use]
pub fn default_compare(a: &PercentileStatsOwned, b: &PercentileStatsOwned) -> i32 {
    let a_won = a.status.as_deref() == Some("won");
    let b_won = b.status.as_deref() == Some("won");
    if a_won && !b_won {
        return 1;
    }
    if !a_won && b_won {
        return -1;
    }
    a.score.unwrap_or(0) - b.score.unwrap_or(0)
}

/// Compute percentile: round(betterThan / totalPlayers * 100).
///
/// Returns `None` when there are no sessions (TS returns null).
#[must_use]
pub fn compute_percentile(
    user: &PercentileStatsOwned,
    sessions: &[PercentileStatsOwned],
) -> Option<PercentileResult> {
    if sessions.is_empty() {
        return None;
    }
    let total_players = sessions.len();
    let better_than = sessions
        .iter()
        .filter(|s| default_compare(user, s) > 0)
        .count();
    let percentile = ((better_than as f64) / (total_players as f64) * 100.0).round() as i32;
    Some(PercentileResult {
        percentile,
        total_players: i32::try_from(total_players).unwrap_or(i32::MAX),
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PercentileResult {
    pub percentile: i32,
    pub total_players: i32,
}

/// Per-game aggregate row (TS user-stats shape, streaks placeholder 0).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserGameStats {
    pub game_slug: String,
    pub games_played: i32,
    pub games_won: i32,
    pub current_streak: i32,
    pub max_streak: i32,
    pub total_score: i32,
    pub average_attempts: Option<i32>,
    pub guess_distribution: serde_json::Value,
    pub perfect_games: i32,
}

/// Build user-stats map entries from raw counters (pure shaping).
#[must_use]
pub fn build_user_game_stats(
    game_slug: &str,
    games_played: i32,
    games_won: i32,
    total_score: i32,
    average_attempts: Option<i32>,
    perfect_games: i32,
    guess_distribution: serde_json::Value,
) -> UserGameStats {
    UserGameStats {
        game_slug: game_slug.to_string(),
        games_played,
        games_won,
        // Platform SDK residual — client uses useStreak()
        current_streak: 0,
        max_streak: 0,
        total_score,
        average_attempts,
        guess_distribution,
        perfect_games,
    }
}

/// Rank from count of users with strictly better score (+1).
#[must_use]
pub fn rank_from_better_count(better_users: usize) -> i32 {
    i32::try_from(better_users + 1).unwrap_or(i32::MAX)
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayPercentileQuery {
    pub game_slug: Option<String>,
    pub status: Option<String>,
    pub attempts: Option<i32>,
    pub score: Option<i32>,
    pub mistakes: Option<i32>,
    pub time_spent_ms: Option<i64>,
    /// Optional pre-supplied totalPlayers for dual-oracle fixture residual.
    pub total_players: Option<i32>,
    /// Optional betterThan count when sessions not inlined.
    pub better_than: Option<i32>,
}

/// GET /api/v1/stats/today-percentile
pub async fn today_percentile_http(Query(q): Query<TodayPercentileQuery>) -> Response {
    let Some(slug) = q
        .game_slug
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return (StatusCode::OK, Json(serde_json::Value::Null)).into_response();
    };
    if !is_valid_game_slug(slug) {
        return (StatusCode::OK, Json(serde_json::Value::Null)).into_response();
    }
    let Some(status) = q.status.as_deref() else {
        return (StatusCode::OK, Json(serde_json::Value::Null)).into_response();
    };
    // When fixture counts provided, compute directly (no DB).
    if let (Some(total), Some(better)) = (q.total_players, q.better_than) {
        if total <= 0 {
            return (StatusCode::OK, Json(serde_json::Value::Null)).into_response();
        }
        let percentile = ((f64::from(better.max(0)) / f64::from(total)) * 100.0).round() as i32;
        return (
            StatusCode::OK,
            Json(json!({
                "percentile": percentile,
                "totalPlayers": total,
                "gameSlug": slug,
                "status": status,
                "slice": "api-v1-hono-monolith",
            })),
        )
            .into_response();
    }
    // Without sessions/DB, pure path returns null (TS empty sessions → null).
    (
        StatusCode::OK,
        Json(json!({
            "percentile": null,
            "totalPlayers": 0,
            "gameSlug": slug,
            "status": status,
            "score": q.score,
            "attempts": q.attempts,
            "mistakes": q.mistakes,
            "timeSpentMs": q.time_spent_ms,
            "stub": true,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStatsBody {
    pub games: Option<Vec<UserStatsInput>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStatsInput {
    pub game_slug: String,
    pub games_played: i32,
    pub games_won: i32,
    pub total_score: i32,
    pub average_attempts: Option<i32>,
    pub perfect_games: Option<i32>,
}

/// POST /api/v1/stats/user-stats/shape — pure aggregate shaping residual.
pub async fn user_stats_shape_http(Json(body): Json<UserStatsBody>) -> Response {
    let games = body.games.unwrap_or_default();
    let mut out = serde_json::Map::new();
    for g in games {
        if !is_valid_game_slug(&g.game_slug) {
            continue;
        }
        let stats = build_user_game_stats(
            &g.game_slug,
            g.games_played,
            g.games_won,
            g.total_score,
            g.average_attempts,
            g.perfect_games.unwrap_or(0),
            json!({}),
        );
        out.insert(
            g.game_slug,
            serde_json::to_value(stats).unwrap_or(json!({})),
        );
    }
    (
        StatusCode::OK,
        Json(json!({
            "stats": out,
            "slice": "api-v1-hono-monolith",
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_compare_prefers_wins() {
        let won = PercentileStatsOwned {
            status: Some("won".into()),
            score: Some(10),
            ..Default::default()
        };
        let lost = PercentileStatsOwned {
            status: Some("lost".into()),
            score: Some(1000),
            ..Default::default()
        };
        assert!(default_compare(&won, &lost) > 0);
        assert!(default_compare(&lost, &won) < 0);
    }

    #[test]
    fn default_compare_by_score_when_same_status() {
        let a = PercentileStatsOwned {
            status: Some("won".into()),
            score: Some(500),
            ..Default::default()
        };
        let b = PercentileStatsOwned {
            status: Some("won".into()),
            score: Some(100),
            ..Default::default()
        };
        assert!(default_compare(&a, &b) > 0);
    }

    #[test]
    fn percentile_empty_is_none() {
        let user = PercentileStatsOwned {
            status: Some("won".into()),
            score: Some(100),
            ..Default::default()
        };
        assert!(compute_percentile(&user, &[]).is_none());
    }

    #[test]
    fn percentile_ranks_correctly() {
        let user = PercentileStatsOwned {
            status: Some("won".into()),
            score: Some(200),
            ..Default::default()
        };
        let sessions = vec![
            PercentileStatsOwned {
                status: Some("won".into()),
                score: Some(100),
                ..Default::default()
            },
            PercentileStatsOwned {
                status: Some("won".into()),
                score: Some(300),
                ..Default::default()
            },
            PercentileStatsOwned {
                status: Some("lost".into()),
                score: Some(0),
                ..Default::default()
            },
        ];
        // better than 100 and lost → 2/3 → 67
        let r = compute_percentile(&user, &sessions).expect("r");
        assert_eq!(r.total_players, 3);
        assert_eq!(r.percentile, 67);
    }

    #[test]
    fn rank_from_better() {
        assert_eq!(rank_from_better_count(0), 1);
        assert_eq!(rank_from_better_count(4), 5);
    }

    #[test]
    fn user_stats_placeholders() {
        let s = build_user_game_stats("sudoku", 10, 7, 900, Some(3), 2, json!({}));
        assert_eq!(s.current_streak, 0);
        assert_eq!(s.max_streak, 0);
        assert_eq!(s.perfect_games, 2);
    }
}
