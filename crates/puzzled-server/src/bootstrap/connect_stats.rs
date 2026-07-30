//! Native Connect StatsService — technology-stack-profile (buffa + connectrpc).
//! GetLeaderboard densifies via product_db when pool present; honest empty residual otherwise.

use std::sync::Arc;

use buffa::EnumValue;
use connectrpc::{ConnectError, ErrorCode, RequestContext, Response, ServiceRequest, ServiceResult};

use super::state::AppState;
use crate::capabilities::leaderboard::adapters::leaderboard_db::{
    fetch_score_leaderboard, LeaderboardPeriod as DbPeriod, LeaderboardQuery, LeaderboardType as DbType,
};
use puzzled_core::puzzle_play::game_slugs::is_valid_game_slug;
use crate::proto::puzzled::v1::{
    GetLeaderboardRequest, GetLeaderboardResponse, GetTodayPercentileRequest,
    GetTodayPercentileResponse, LeaderboardEntry, LeaderboardPeriod, LeaderboardType, StatsService,
};

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
            let percentile =
                ((f64::from(better.max(0)) / f64::from(total)) * 100.0).round() as i32;
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
}

pub fn stats_connect_service(state: AppState) -> Arc<StatsConnectService> {
    Arc::new(StatsConnectService::new(state))
}
