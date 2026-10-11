//! Native Connect StatsService — technology-stack-profile (buffa + connectrpc).
//! GetLeaderboard densifies via product_db when pool present; honest empty residual otherwise.

use std::sync::Arc;

use buffa::EnumValue;
use chrono::Utc;
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};

use super::state::AppState;
use crate::capabilities::leaderboard::adapters::leaderboard_db::{
    fetch_score_leaderboard, LeaderboardPeriod as DbPeriod, LeaderboardQuery,
    LeaderboardType as DbType,
};
use crate::capabilities::stats::adapters::sessions_stats_db::{
    today_overview, today_percentile, user_history_on_connection, user_stats_on_connection,
};
use crate::proto::puzzled::v1::{
    GetHistoryRequest, GetHistoryResponse, GetLeaderboardRequest, GetLeaderboardResponse,
    GetTodayOverviewRequest, GetTodayOverviewResponse, GetTodayPercentileRequest,
    GetTodayPercentileResponse, GetUserStatsRequest, GetUserStatsResponse, LeaderboardEntry,
    LeaderboardPeriod, LeaderboardType, SessionEntry, StatsService, UserGameStats,
};
use puzzled_core::puzzle_play::daily_time::product_day_key_string;
use puzzled_core::puzzle_play::game_slugs::is_valid_game_slug;

#[derive(Clone)]
pub struct StatsConnectService {
    state: AppState,
}

impl StatsConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }

    async fn adopt_guest_progress_if_needed(
        &self,
        ctx: &RequestContext,
    ) -> Result<crate::bootstrap::identity::RequestAccess, ConnectError> {
        crate::bootstrap::identity::admitted_request_identities(
            ctx,
            self.state.pool.as_ref(),
            false,
        )
        .await
    }
}

fn map_type(value: EnumValue<LeaderboardType>) -> DbType {
    match value.as_known() {
        Some(LeaderboardType::Streak) => DbType::Streak,
        Some(LeaderboardType::Score) | Some(LeaderboardType::Unspecified) | None => DbType::Score,
    }
}

fn map_period(value: EnumValue<LeaderboardPeriod>) -> DbPeriod {
    match value.as_known() {
        Some(LeaderboardPeriod::Today) => DbPeriod::Today,
        Some(LeaderboardPeriod::Week) => DbPeriod::Week,
        Some(LeaderboardPeriod::All) | Some(LeaderboardPeriod::Unspecified) | None => DbPeriod::All,
    }
}

fn clamp_limit(limit: i32) -> i32 {
    if (1..=100).contains(&limit) {
        limit
    } else if limit <= 0 {
        10
    } else {
        100
    }
}

fn to_proto_entry(
    entry: puzzled_core::leaderboard::enrich::LeaderboardEntry,
    viewer_id: Option<&str>,
) -> LeaderboardEntry {
    LeaderboardEntry {
        rank: entry.rank,
        // Wire compatibility: this field now identifies only this response entry.
        // Never derive it from a player id, including by hashing.
        user_id: uuid::Uuid::now_v7().to_string(),
        user_name: entry.user_name,
        // Avatar URLs can contain stable account identifiers. Public rows use initials.
        user_image: None,
        is_viewer: viewer_id.is_some_and(|id| id == entry.user_id.to_string()),
        value: entry.value,
        ..Default::default()
    }
}

// Viewer markers are private response data; public intermediaries must not store them.
fn leaderboard_response(entries: Vec<LeaderboardEntry>) -> ServiceResult<GetLeaderboardResponse> {
    Ok(Response::new(GetLeaderboardResponse {
        entries,
        ..Default::default()
    })
    .with_header("cache-control", "private, no-store, max-age=0")
    .with_header("cdn-cache-control", "no-store"))
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl StatsService for StatsConnectService {
    async fn get_leaderboard(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetLeaderboardRequest>,
    ) -> ServiceResult<GetLeaderboardResponse> {
        let req = request.to_owned_message();
        let game_slug = req.game_slug.trim();
        if game_slug.is_empty() {
            return Err(ConnectError::new(
                ErrorCode::InvalidArgument,
                "game_slug_required",
            ));
        }

        let query = LeaderboardQuery {
            game_slug: game_slug.to_string(),
            leaderboard_type: map_type(req.r#type),
            period: map_period(req.period),
            limit: clamp_limit(req.limit),
        };

        if let Some(pool) = &self.state.pool {
            match fetch_score_leaderboard(pool, &query).await {
                Ok(entries) => {
                    let access = crate::bootstrap::identity::admitted_request_identities(
                        &ctx,
                        self.state.pool.as_ref(),
                        false,
                    )
                    .await?;
                    let viewer_id = access.primary().map(|identity| identity.user_id.as_str());
                    let entries = entries
                        .into_iter()
                        .map(|entry| to_proto_entry(entry, viewer_id))
                        .collect();
                    access.commit().await?;
                    return leaderboard_response(entries);
                }
                Err(error) => {
                    tracing::warn!(
                        %error,
                        game_slug = %query.game_slug,
                        "connect GetLeaderboard product_db failed"
                    );
                }
            }
        }

        // No pool or read failure: honest residual empty board (do not invent scores).
        leaderboard_response(Vec::new())
    }

    async fn get_today_percentile(
        &self,
        _ctx: RequestContext,
        request: ServiceRequest<'_, GetTodayPercentileRequest>,
    ) -> ServiceResult<GetTodayPercentileResponse> {
        let req = request.to_owned_message();
        let slug = req.game_slug.trim();
        if slug.is_empty() || !is_valid_game_slug(slug) {
            return Response::ok(GetTodayPercentileResponse {
                dispatch: "invalid_or_empty".into(),
                ..Default::default()
            });
        }
        let status = req.status.trim();
        if status.is_empty() {
            return Response::ok(GetTodayPercentileResponse {
                game_slug: slug.into(),
                dispatch: "status_required".into(),
                ..Default::default()
            });
        }

        // Fixture residual: pure dual-oracle when counts supplied (no invent from empty DB).
        if let (Some(total), Some(better)) = (req.total_players, req.better_than) {
            if total <= 0 {
                return Response::ok(GetTodayPercentileResponse {
                    game_slug: slug.into(),
                    status: status.into(),
                    dispatch: "empty_cohort".into(),
                    ..Default::default()
                });
            }
            let percentile = ((f64::from(better.max(0)) / f64::from(total)) * 100.0).round() as i32;
            return Response::ok(GetTodayPercentileResponse {
                percentile: Some(percentile),
                total_players: total,
                game_slug: slug.into(),
                status: status.into(),
                score: req.score,
                attempts: req.attempts,
                mistakes: req.mistakes,
                time_spent_ms: req.time_spent_ms,
                stub: false,
                dispatch: "product_fixture".into(),
                ..Default::default()
            });
        }

        if let Some(pool) = &self.state.pool {
            // Match each game's compareForPercentile, with wins first and strict
            // comparisons so tied finishes do not count as beaten players.
            let metric = match slug {
                "word-hive" => i64::from(req.score.unwrap_or(0)),
                "word-groups" => -i64::from(req.mistakes.unwrap_or(4)),
                "word-guess" => -i64::from(req.attempts.unwrap_or(6)),
                "quad-words" | "arithmo" | "word-box" => {
                    -req.attempts.map(i64::from).unwrap_or(i64::MAX)
                }
                _ => req.time_spent_ms.unwrap_or(i64::MAX).saturating_neg(),
            };
            let day_key = product_day_key_string(Utc::now());
            let (percentile, total_players) =
                today_percentile(pool, &day_key, slug, status == "won", metric)
                    .await
                    .map_err(|error| {
                        tracing::warn!(%error, game_slug = slug, "today percentile read failed");
                        ConnectError::new(ErrorCode::Internal, "today_percentile_failed")
                    })?;
            return Response::ok(GetTodayPercentileResponse {
                percentile,
                total_players,
                game_slug: slug.into(),
                status: status.into(),
                score: req.score,
                attempts: req.attempts,
                mistakes: req.mistakes,
                time_spent_ms: req.time_spent_ms,
                stub: false,
                dispatch: "product_db_sessions".into(),
                ..Default::default()
            });
        }

        // No database: do not invent a cohort.
        Response::ok(GetTodayPercentileResponse {
            percentile: None,
            total_players: 0,
            game_slug: slug.into(),
            status: status.into(),
            score: req.score,
            attempts: req.attempts,
            mistakes: req.mistakes,
            time_spent_ms: req.time_spent_ms,
            stub: true,
            dispatch: if self.state.pool.is_some() {
                "product_db_sessions_residual"
            } else {
                "pure_residual_no_db"
            }
            .into(),
            ..Default::default()
        })
    }
    async fn get_today_overview(
        &self,
        _ctx: RequestContext,
        _request: ServiceRequest<'_, GetTodayOverviewRequest>,
    ) -> ServiceResult<GetTodayOverviewResponse> {
        let day_key = product_day_key_string(Utc::now());
        let (player_count, completions) = match &self.state.pool {
            Some(pool) => today_overview(pool, &day_key).await.map_err(|e| {
                tracing::warn!(%e, "today overview failed");
                ConnectError::new(ErrorCode::Internal, "today_overview_failed")
            })?,
            None => (0, Vec::new()),
        };
        let completions_proto = completions
            .iter()
            .map(|c| crate::proto::puzzled::v1::GameCompletionCount {
                game_slug: c
                    .get("gameSlug")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                count: c.get("count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                ..Default::default()
            })
            .collect();
        Response::ok(GetTodayOverviewResponse {
            player_count,
            completions: completions_proto,
            ..Default::default()
        })
    }

    async fn get_user_stats(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetUserStatsRequest>,
    ) -> ServiceResult<GetUserStatsResponse> {
        let mut access = self.adopt_guest_progress_if_needed(&ctx).await?;
        let identity = access.primary().cloned().ok_or_else(|| {
            ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit")
        })?;
        let req = request.to_owned_message();
        let (games, total_played, total_won) = match access.connection() {
            Some(connection) => user_stats_on_connection(connection, &identity.user_id)
                .await
                .map_err(|e| {
                    tracing::warn!(%e, "user stats read failed");
                    ConnectError::new(ErrorCode::Internal, "user_stats_read_failed")
                })?,
            None => (Vec::new(), 0, 0),
        };
        let games_proto: Vec<UserGameStats> = games
            .iter()
            .map(|g| UserGameStats {
                game_slug: g
                    .get("gameSlug")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                games_played: g.get("gamesPlayed").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                games_won: g.get("gamesWon").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                best_score: g.get("bestScore").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                ..Default::default()
            })
            .collect();
        let _ = req;
        access.commit().await?;
        Response::ok(GetUserStatsResponse {
            games: games_proto,
            total_played,
            total_won,
            ..Default::default()
        })
    }

    async fn get_history(
        &self,
        ctx: RequestContext,
        request: ServiceRequest<'_, GetHistoryRequest>,
    ) -> ServiceResult<GetHistoryResponse> {
        let mut access = self.adopt_guest_progress_if_needed(&ctx).await?;
        let identity = access.primary().cloned().ok_or_else(|| {
            ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit")
        })?;
        let req = request.to_owned_message();
        let slug = (!req.game_slug.trim().is_empty()).then(|| req.game_slug.trim().to_string());
        let rows = match access.connection() {
            Some(connection) => user_history_on_connection(
                connection,
                &identity.user_id,
                slug.as_deref(),
                req.limit,
            )
            .await
            .map_err(|e| {
                tracing::warn!(%e, "history read failed");
                ConnectError::new(ErrorCode::Internal, "history_read_failed")
            })?,
            None => Vec::new(),
        };
        let sessions: Vec<SessionEntry> = rows
            .iter()
            .map(|r| SessionEntry {
                game_slug: r
                    .get("gameSlug")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                puzzle_id: r
                    .get("puzzleId")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                puzzle_date: r
                    .get("puzzleDate")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                status: r
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                score: r.get("score").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                attempts: r.get("attempts").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                time_spent_ms: r.get("timeSpentMs").and_then(|v| v.as_u64()).unwrap_or(0),
                mode: r
                    .get("mode")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                ..Default::default()
            })
            .collect();
        access.commit().await?;
        Response::ok(GetHistoryResponse {
            sessions,
            ..Default::default()
        })
    }
}

pub fn stats_connect_service(state: AppState) -> Arc<StatsConnectService> {
    Arc::new(StatsConnectService::new(state))
}

#[cfg(test)]
mod public_disclosure_tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    async fn percentile_rpc(pool: &sqlx::PgPool, body: serde_json::Value) -> serde_json::Value {
        let response = crate::router(AppState::new(Some(pool.clone())))
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/puzzled.v1.StatsService/GetTodayPercentile")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap()
    }

    #[tokio::test]
    async fn get_today_percentile_ranks_twelve_seeded_sessions() {
        let Some(pool) = crate::test_support::fresh_database().await else {
            return;
        };
        let day_key = product_day_key_string(Utc::now());
        for i in 0..12_i32 {
            sqlx::query(
                "INSERT INTO game_sessions
                 (user_id, game_slug, mode, status, score, attempts, time_spent_ms,
                  day_key, is_ritual, module_class)
                 VALUES ($1, 'sudoku', 'daily', 'won', 100, 1, $2, $3, true, 'puzzle_ritual')",
            )
            .bind(uuid::Uuid::now_v7())
            .bind((i + 1) * 1_000)
            .bind(&day_key)
            .execute(&pool)
            .await
            .unwrap();
        }
        // Faster than six, tied with one, slower than five: ties are not beaten.
        let response = percentile_rpc(
            &pool,
            serde_json::json!({"gameSlug": "sudoku", "status": "won", "timeSpentMs": "6000"}),
        )
        .await;
        assert_eq!(response["totalPlayers"], 12);
        assert_eq!(response["percentile"], 50);
        assert!(!response["stub"].as_bool().unwrap_or(false));
        assert_eq!(response["dispatch"], "product_db_sessions");

        // Non-ritual, unfinished, other-day, other-module and other-game rows
        // cannot inflate the cohort, even if their finish metric is worse.
        for (slug, day, ritual, class, status) in [
            ("sudoku", day_key.as_str(), false, "puzzle_ritual", "won"),
            (
                "sudoku",
                day_key.as_str(),
                true,
                "puzzle_ritual",
                "in_progress",
            ),
            ("sudoku", "2000-01-01", true, "puzzle_ritual", "won"),
            ("sudoku", day_key.as_str(), true, "other", "won"),
            ("crossword", day_key.as_str(), true, "puzzle_ritual", "won"),
        ] {
            sqlx::query(
                "INSERT INTO game_sessions
                 (user_id, game_slug, mode, status, time_spent_ms, day_key, is_ritual, module_class)
                 VALUES ($1, $2, 'daily', $3::game_status, 99000, $4, $5, $6)",
            )
            .bind(uuid::Uuid::now_v7())
            .bind(slug)
            .bind(status)
            .bind(day)
            .bind(ritual)
            .bind(class)
            .execute(&pool)
            .await
            .unwrap();
        }
        let response = percentile_rpc(
            &pool,
            serde_json::json!({"gameSlug": "sudoku", "status": "won", "timeSpentMs": "6000"}),
        )
        .await;
        assert_eq!(response["totalPlayers"], 12);
        assert_eq!(response["percentile"], 50);

        // A win beats a loss regardless of elapsed time. Losses still compare time.
        sqlx::query("UPDATE game_sessions SET status = 'lost' WHERE time_spent_ms = 1000")
            .execute(&pool)
            .await
            .unwrap();
        let response = percentile_rpc(
            &pool,
            serde_json::json!({"gameSlug": "sudoku", "status": "won", "timeSpentMs": "6000"}),
        )
        .await;
        assert_eq!(response["percentile"], 58);
        let response = percentile_rpc(
            &pool,
            serde_json::json!({"gameSlug": "sudoku", "status": "lost", "timeSpentMs": "500"}),
        )
        .await;
        assert_eq!(response["percentile"], 8);

        // Below ten finishers, return the real count without revealing percentile.
        sqlx::query("DELETE FROM game_sessions WHERE time_spent_ms >= 10000")
            .execute(&pool)
            .await
            .unwrap();
        let response = percentile_rpc(
            &pool,
            serde_json::json!({"gameSlug": "sudoku", "status": "won", "timeSpentMs": "6000"}),
        )
        .await;
        assert_eq!(response["totalPlayers"], 9);
        assert!(response
            .get("percentile")
            .is_none_or(serde_json::Value::is_null));
        assert_eq!(response["dispatch"], "product_db_sessions");
    }

    #[tokio::test]
    async fn get_today_percentile_uses_each_games_ranking_metric() {
        let Some(pool) = crate::test_support::fresh_database().await else {
            return;
        };
        let day_key = product_day_key_string(Utc::now());
        for slug in [
            "word-groups",
            "word-hive",
            "word-guess",
            "quad-words",
            "arithmo",
            "word-box",
        ] {
            for i in 0..12_i32 {
                sqlx::query(
                    "INSERT INTO game_sessions
                     (user_id, game_slug, mode, status, score, attempts, time_spent_ms,
                      day_key, is_ritual, module_class)
                     VALUES ($1, $2, 'daily', 'won', $3, $4, 1000, $5, true, 'puzzle_ritual')",
                )
                .bind(uuid::Uuid::now_v7())
                .bind(slug)
                .bind(if slug == "word-groups" {
                    100 - (i % 4) * 25
                } else {
                    i
                })
                .bind(i + 1)
                .bind(&day_key)
                .execute(&pool)
                .await
                .unwrap();
            }
            let response = percentile_rpc(
                &pool,
                serde_json::json!({
                    "gameSlug": slug, "status": "won", "attempts": 6,
                    "mistakes": 1, "score": 6, "timeSpentMs": "99000"
                }),
            )
            .await;
            assert_eq!(response["totalPlayers"], 12, "{slug}");
            assert_eq!(response["percentile"], 50, "{slug}");
            assert_eq!(response["dispatch"], "product_db_sessions", "{slug}");
        }
    }

    #[test]
    fn public_entries_do_not_disclose_or_reuse_player_identifiers() {
        let id = uuid::Uuid::from_u128(1);
        let row = puzzled_core::leaderboard::enrich::LeaderboardEntry {
            rank: 2,
            user_id: id,
            user_name: Some("Player".into()),
            user_image: Some(format!("https://avatars.invalid/{id}")),
            value: 700,
        };
        let a = to_proto_entry(row.clone(), Some(&id.to_string()));
        let b = to_proto_entry(row, None);
        assert_ne!(a.user_id, id.to_string());
        assert_ne!(a.user_id, b.user_id);
        assert!(a.user_image.is_none());
        assert!(a.is_viewer);
        assert!(!b.is_viewer);
        assert_eq!(
            (a.rank, a.value, a.user_name.as_deref()),
            (2, 700, Some("Player"))
        );
        let response = leaderboard_response(vec![a]).unwrap();
        assert_eq!(
            response.headers["cache-control"],
            "private, no-store, max-age=0"
        );
        assert_eq!(response.headers["cdn-cache-control"], "no-store");
    }
}
