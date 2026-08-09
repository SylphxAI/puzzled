//! Native Connect StatsService — technology-stack-profile (buffa + connectrpc).
//! GetLeaderboard densifies via product_db when pool present; honest empty residual otherwise.

use std::sync::Arc;

use buffa::EnumValue;
use connectrpc::{
    ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult,
};

use super::identity::require_identity;
use super::state::AppState;
use crate::capabilities::leaderboard::adapters::leaderboard_db::{
    fetch_score_leaderboard, LeaderboardPeriod as DbPeriod, LeaderboardQuery,
    LeaderboardType as DbType,
};
use crate::capabilities::stats::adapters::sessions_stats_db::{
    today_overview, user_history, user_stats,
};
use crate::proto::puzzled::v1::{
    GetHistoryRequest, GetHistoryResponse, GetLeaderboardRequest, GetLeaderboardResponse,
    GetTodayOverviewRequest, GetTodayOverviewResponse, GetTodayPercentileRequest,
    GetTodayPercentileResponse, GetUserStatsRequest, GetUserStatsResponse, LeaderboardEntry,
    LeaderboardPeriod, LeaderboardType, SessionEntry, StatsService, UserGameStats,
};
use puzzled_core::puzzle_play::game_slugs::is_valid_game_slug;

#[derive(Clone)]
pub struct StatsConnectService {
    state: AppState,
}

impl StatsConnectService {
    pub fn new(state: AppState) -> Self {
        Self { state }
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

fn to_proto_entry(entry: puzzled_core::leaderboard::enrich::LeaderboardEntry) -> LeaderboardEntry {
    LeaderboardEntry {
        rank: entry.rank,
        user_id: entry.user_id.to_string(),
        user_name: entry.user_name,
        user_image: entry.user_image,
        value: entry.value,
        ..Default::default()
    }
}

#[allow(refining_impl_trait_internal, refining_impl_trait_reachable)]
impl StatsService for StatsConnectService {
    async fn get_leaderboard(
        &self,
        _ctx: RequestContext,
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
                    return Response::ok(GetLeaderboardResponse {
                        entries: entries.into_iter().map(to_proto_entry).collect(),
                        ..Default::default()
                    });
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
        Response::ok(GetLeaderboardResponse {
            entries: Vec::new(),
            ..Default::default()
        })
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

        // Without sessions/DB densify: honest stub residual (parity with REST null path).
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
        let (player_count, completions) = match &self.state.pool {
            Some(pool) => today_overview(pool).await.map_err(|e| {
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
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        let (games, total_played, total_won) = match &self.state.pool {
            Some(pool) => user_stats(pool, &identity.user_id).await.map_err(|e| {
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
        let identity = require_identity(&ctx)?;
        let req = request.to_owned_message();
        let slug = (!req.game_slug.trim().is_empty()).then(|| req.game_slug.trim().to_string());
        let rows = match &self.state.pool {
            Some(pool) => user_history(pool, &identity.user_id, slug.as_deref(), req.limit)
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
        Response::ok(GetHistoryResponse {
            sessions,
            ..Default::default()
        })
    }
}

pub fn stats_connect_service(state: AppState) -> Arc<StatsConnectService> {
    Arc::new(StatsConnectService::new(state))
}
