//! Score leaderboard read — parity with `server/api/routes/stats.ts` GET /leaderboard.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::game_slugs::is_valid_game_slug;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: Uuid,
    pub user_name: Option<String>,
    pub user_image: Option<String>,
    pub value: i32,
}

#[derive(Debug, Clone)]
pub struct LeaderboardQuery {
    pub game_slug: String,
    pub leaderboard_type: LeaderboardType,
    pub period: LeaderboardPeriod,
    pub limit: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaderboardType {
    Streak,
    Score,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaderboardPeriod {
    Today,
    Week,
    All,
}

impl LeaderboardQuery {
    /// Parse query string fields matching TS `LeaderboardQuerySchema`.
    #[must_use]
    pub fn from_params(
        game_slug: Option<&str>,
        leaderboard_type: Option<&str>,
        period: Option<&str>,
        limit: Option<&str>,
    ) -> Option<Self> {
        let game_slug = game_slug?.trim();
        if game_slug.is_empty() {
            return None;
        }

        let leaderboard_type = match leaderboard_type.unwrap_or("streak") {
            "streak" => LeaderboardType::Streak,
            "score" => LeaderboardType::Score,
            _ => return None,
        };

        let period = match period.unwrap_or("all") {
            "today" => LeaderboardPeriod::Today,
            "week" => LeaderboardPeriod::Week,
            "all" => LeaderboardPeriod::All,
            _ => return None,
        };

        let limit = limit
            .and_then(|value| value.parse::<i32>().ok())
            .unwrap_or(10);
        if !(1..=100).contains(&limit) {
            return None;
        }

        Some(Self {
            game_slug: game_slug.to_string(),
            leaderboard_type,
            period,
            limit,
        })
    }
}

fn today_utc_start() -> DateTime<Utc> {
    let today = Utc::now().date_naive();
    today
        .and_hms_opt(0, 0, 0)
        .map(|naive| DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc))
        .unwrap_or_else(Utc::now)
}

fn period_start(period: LeaderboardPeriod) -> Option<DateTime<Utc>> {
    match period {
        LeaderboardPeriod::All => None,
        LeaderboardPeriod::Today => Some(today_utc_start()),
        LeaderboardPeriod::Week => {
            let mut start = today_utc_start();
            start -= chrono::Duration::days(7);
            Some(start)
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RankRow {
    pub user_id: Uuid,
    pub total_score: i32,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DisplayRow {
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

/// Build leaderboard entries from SQL rank rows + display cache — parity with
/// `stats.ts` rankings.map + getDisplayData enrichment.
#[must_use]
pub fn build_leaderboard_entries(
    rows: &[RankRow],
    display_rows: &[DisplayRow],
) -> Vec<LeaderboardEntry> {
    let display_map: std::collections::HashMap<Uuid, &DisplayRow> = display_rows
        .iter()
        .map(|row| (row.user_id, row))
        .collect();

    rows.iter()
        .enumerate()
        .map(|(index, row)| {
            let display = display_map.get(&row.user_id);
            LeaderboardEntry {
                rank: (index as i32) + 1,
                user_id: row.user_id,
                user_name: display
                    .and_then(|entry| entry.display_name.clone())
                    .or_else(|| Some("Anonymous".to_string())),
                user_image: display.and_then(|entry| entry.avatar_url.clone()),
                value: row.total_score,
            }
        })
        .collect()
}

/// Load score leaderboard rows from Postgres when pool is configured.
pub async fn fetch_score_leaderboard(
    pool: &PgPool,
    query: &LeaderboardQuery,
) -> Result<Vec<LeaderboardEntry>, sqlx::Error> {
    if !is_valid_game_slug(&query.game_slug) {
        return Ok(Vec::new());
    }

    if query.leaderboard_type == LeaderboardType::Streak {
        return Ok(Vec::new());
    }

    let start = period_start(query.period);
    let limit = i64::from(query.limit);

    let rows: Vec<RankRow> = if let Some(start) = start {
        sqlx::query_as::<_, RankRow>(
            r#"
            SELECT
                gs.user_id,
                COALESCE(SUM(gs.score), 0)::int AS total_score
            FROM game_sessions gs
            INNER JOIN user_preferences up ON gs.user_id = up.user_id
            WHERE gs.game_slug = $1
              AND up.leaderboard_visible = true
              AND gs.completed_at >= $2
            GROUP BY gs.user_id
            ORDER BY COALESCE(SUM(gs.score), 0) DESC
            LIMIT $3
            "#,
        )
        .bind(&query.game_slug)
        .bind(start)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, RankRow>(
            r#"
            SELECT
                gs.user_id,
                COALESCE(SUM(gs.score), 0)::int AS total_score
            FROM game_sessions gs
            INNER JOIN user_preferences up ON gs.user_id = up.user_id
            WHERE gs.game_slug = $1
              AND up.leaderboard_visible = true
            GROUP BY gs.user_id
            ORDER BY COALESCE(SUM(gs.score), 0) DESC
            LIMIT $2
            "#,
        )
        .bind(&query.game_slug)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    if rows.is_empty() {
        return Ok(Vec::new());
    }

    let user_ids: Vec<Uuid> = rows.iter().map(|row| row.user_id).collect();
    let display_rows: Vec<DisplayRow> = sqlx::query_as::<_, DisplayRow>(
        r#"
        SELECT user_id, display_name, avatar_url
        FROM user_display_cache
        WHERE user_id = ANY($1)
        "#,
    )
    .bind(&user_ids)
    .fetch_all(pool)
    .await?;

    Ok(build_leaderboard_entries(&rows, &display_rows))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_query() {
        let query = LeaderboardQuery::from_params(Some("sudoku"), None, None, None);
        assert!(query.is_some());
        let query = query.unwrap_or_else(|| LeaderboardQuery {
            game_slug: String::new(),
            leaderboard_type: LeaderboardType::Streak,
            period: LeaderboardPeriod::All,
            limit: 0,
        });
        assert_eq!(query.leaderboard_type, LeaderboardType::Streak);
        assert_eq!(query.period, LeaderboardPeriod::All);
        assert_eq!(query.limit, 10);
    }

    #[test]
    fn rejects_invalid_limit() {
        assert!(LeaderboardQuery::from_params(Some("sudoku"), Some("score"), None, Some("0")).is_none());
        assert!(LeaderboardQuery::from_params(Some("sudoku"), Some("score"), None, Some("101")).is_none());
    }

    #[test]
    fn today_start_is_midnight_utc() {
        use chrono::Timelike;

        let start = period_start(LeaderboardPeriod::Today);
        assert!(start.is_some());
        let start = start.unwrap_or_else(Utc::now);
        assert_eq!(start.time().hour(), 0);
        assert_eq!(start.time().minute(), 0);
    }
}